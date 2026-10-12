const normalizeString = (value) =>
  String(value || "").trim().toLowerCase();

const normalizeArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const getValidHeight = (value) => {
  const height = toNumber(value);

  // This matching system expects adult model heights in centimetres.
  if (height === null || height < 140 || height > 220) {
    return null;
  }

  return height;
};

const calculateAge = (birthdate) => {
  if (!birthdate) return null;

  const date = new Date(birthdate);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();

  const beforeBirthday =
    today.getMonth() < date.getMonth() ||
    (today.getMonth() === date.getMonth() &&
      today.getDate() < date.getDate());

  if (beforeBirthday) age--;

  return age >= 0 ? age : null;
};

const calculateRangeMatch = (value, min, max) => {
  if (value === null || value === undefined) return 0.5;

  const number = toNumber(value);
  if (number === null) return 0.5;

  const lower = toNumber(min);
  const upper = toNumber(max);

  if (lower === null && upper === null) return 1;
  if (lower !== null && number < lower) {
    return Math.max(0, 1 - (lower - number) / Math.max(lower, 1));
  }
  if (upper !== null && number > upper) {
    return Math.max(0, 1 - (number - upper) / Math.max(upper, 1));
  }

  return 1;
};

const calculateOverlapScore = (actual, required) => {
  const actualItems = normalizeArray(actual).map(normalizeString);
  const requiredItems = normalizeArray(required).map(normalizeString);

  if (requiredItems.length === 0) return 1;
  if (actualItems.length === 0) return 0;

  const matched = requiredItems.filter((item) =>
    actualItems.includes(item)
  ).length;

  return matched / requiredItems.length;
};

const calculateGenderMatch = (modelGender, eventGender) => {
  const required = normalizeString(eventGender);

  if (!required || required === "any" || required === "all") return 1;

  return normalizeString(modelGender) === required ? 1 : 0;
};

const calculateLocationMatch = (modelLocation, eventLocation) => {
  const required = normalizeString(eventLocation);
  const actual = normalizeString(modelLocation);

  if (!required || !actual) return 0.5;
  if (actual === required) return 1;
  if (actual.includes(required) || required.includes(actual)) return 0.75;

  return 0;
};

const calculateModelEventFeatures = (model, event) => {
  const height = getValidHeight(model.height);
  const age = calculateAge(model.birthdate);

  const requiredHeightMin = toNumber(event.minHeight);
  const requiredHeightMax = toNumber(event.maxHeight);
  const requiredAgeMin = toNumber(event.minAge);
  const requiredAgeMax = toNumber(event.maxAge);

  return {
    heightMatch: height === null
      ? 0
      : calculateRangeMatch(height, requiredHeightMin, requiredHeightMax),

    ageMatch: age === null
      ? 0.5
      : calculateRangeMatch(age, requiredAgeMin, requiredAgeMax),

    skillsMatch: calculateOverlapScore(
      model.skills,
      event.requiredSkills
    ),

    categoriesMatch: calculateOverlapScore(
      model.categories,
      event.requiredCategories
    ),

    genderMatch: calculateGenderMatch(model.gender, event.gender),

    locationMatch: calculateLocationMatch(
      model.location,
      event.location
    ),
  };
};

// Fallback scoring so the service can work without an external ML module.

const predictMatch = async (features, event) => {
  const weights = {
    heightMatch: 0.20,
    ageMatch: 0.15,
    skillsMatch: 0.25,
    categoriesMatch: 0.20,
    genderMatch: 0.10,
    locationMatch: 0.10,
  };

  const score = Object.entries(weights).reduce(
    (total, [key, weight]) =>
      total + (features[key] ?? 0) * weight,
    0
  );

  const hasRequiredSkills =
    normalizeArray(event.requiredSkills).length > 0;
  const hasRequiredCategories =
    normalizeArray(event.requiredCategories).length > 0;

  const hasHeightRequirement =
    toNumber(event.minHeight) !== null ||
    toNumber(event.maxHeight) !== null;

  const hasGenderRequirement =
    !["", "any", "all"].includes(normalizeString(event.gender));

  const compatible =
    (!hasRequiredSkills || features.skillsMatch > 0) &&
    (!hasRequiredCategories || features.categoriesMatch > 0) &&
    (!hasHeightRequirement || features.heightMatch > 0) &&
    (!hasGenderRequirement || features.genderMatch > 0);

  return {
    score: Math.round(score * 100),
    compatible,
  };
};


const getRecommendation = (score) => {
  if (score >= 80) return "Highly Recommended";
  if (score >= 60) return "Recommended";
  if (score >= 40) return "Potential Match";
  return "Low Match";
};

const calculateModelEventMatch = async (model, event) => {
  const features = calculateModelEventFeatures(model, event);
  const prediction = await predictMatch(features, event);

  const rawScore = Number(prediction.score);
  const safeRawScore = Number.isFinite(rawScore)
    ? Math.max(0, Math.min(100, rawScore))
    : 0;

  const modelSkills = normalizeArray(model.skills);
  const modelCategories = normalizeArray(model.categories);
  const requiredSkills = normalizeArray(event.requiredSkills);
  const requiredCategories = normalizeArray(event.requiredCategories);

  const rawHeight = toNumber(model.height);
  const validHeight = getValidHeight(model.height);

  const hasSkills = modelSkills.length > 0;
  const hasCategories = modelCategories.length > 0;
  const invalidHeight = rawHeight !== null && validHeight === null;

  let profilePenalty = 1;

  if (requiredSkills.length > 0 && !hasSkills) {
    profilePenalty -= 0.15;
  }

  if (requiredCategories.length > 0 && !hasCategories) {
    profilePenalty -= 0.15;
  }

  if (invalidHeight) {
    profilePenalty *= 0.60;
  }

  const adjustedScore = Number(
    (safeRawScore * profilePenalty).toFixed(2)
  );

  return {
    id: model._id,
    fullName: model.fullName || "Unnamed Model",
    location: model.location || "",
    gender: model.gender || "",
    categories: model.categories || [],
    skills: model.skills || [],
    height: model.height || "",
    birthdate: model.birthdate || "",
    profileImage: model.profileImage || "",
    matchScore: adjustedScore,
    rawMatchScore: safeRawScore,
    profileCompleteness: {
      hasSkills,
      hasCategories,
      invalidHeight,
    },
    recommendation: getRecommendation(adjustedScore),
    compatible: prediction.compatible,
  };
};

const rankModelsForEvent = async (models, event) => {
  const matches = await Promise.all(
    models.map((model) => calculateModelEventMatch(model, event))
  );

  return matches.sort((a, b) => b.matchScore - a.matchScore);
};

module.exports = {
  calculateModelEventMatch,
  rankModelsForEvent,
};