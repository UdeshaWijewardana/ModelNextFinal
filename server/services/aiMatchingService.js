const { predictMatch } = require('./randomForestService');

const normalizeString = (value) =>
  String(value || '').trim().toLowerCase();

const normalizeArray = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean);
};

const calculateAge = (birthdate) => {
  if (!birthdate) return null;

  const birth = new Date(birthdate);

  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();

  let age = today.getFullYear() - birth.getFullYear();

  const monthDifference = today.getMonth() - birth.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 &&
      today.getDate() < birth.getDate())
  ) {
    age--;
  }

  return age;
};

const toNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};

const calculateRangeDifference = (value, min, max) => {
  if (value === null) return 999;

  const minimum = toNumber(min);
  const maximum = toNumber(max);

  if (minimum !== null && value < minimum) {
    return minimum - value;
  }

  if (maximum !== null && value > maximum) {
    return value - maximum;
  }

  return 0;
};

const calculateRangeMatch = (value, min, max) => {
  if (value === null) return 0;

  const minimum = toNumber(min);
  const maximum = toNumber(max);

  if (minimum === null && maximum === null) {
    return 1;
  }

  if (minimum !== null && value < minimum) {
    return 0;
  }

  if (maximum !== null && value > maximum) {
    return 0;
  }

  return 1;
};

const calculateOverlapScore = (modelValues, requiredValues) => {
  if (!requiredValues.length) {
    return 0.5;
  }

  if (!modelValues.length) {
    return 0;
  }

  const matches = requiredValues.filter((required) =>
    modelValues.some(
      (modelValue) =>
        modelValue === required ||
        modelValue.includes(required) ||
        required.includes(modelValue)
    )
  );

  return matches.length / requiredValues.length;
};

const calculateGenderMatch = (modelGender, requiredGender) => {
  const required = normalizeString(requiredGender);

  if (!required || required === 'any') {
    return 0.5;
  }

  const model = normalizeString(modelGender);

  if (!model) {
    return 0;
  }

  return model === required ? 1 : 0;
};

const calculateLocationMatch = (
  modelLocation,
  eventLocation
) => {
  const model = normalizeString(modelLocation);
  const event = normalizeString(eventLocation);

  if (
    !model ||
    !event ||
    event === 'to be confirmed'
  ) {
    return 0.5;
  }

  if (model === event) {
    return 1;
  }

  if (
    model.includes(event) ||
    event.includes(model)
  ) {
    return 1;
  }

  return 0;
};

const calculateModelEventFeatures = (model, event) => {
  const modelAge = calculateAge(model.birthdate);
  const modelHeight = toNumber(model.height);

  const requiredCategories =
    normalizeArray(event.requiredCategories);

  const requiredSkills =
    normalizeArray(event.requiredSkills);

  const modelCategories =
    normalizeArray(model.categories);

  const modelSkills =
    normalizeArray(model.skills);

  const genderMatch = calculateGenderMatch(
    model.gender,
    event.requiredGender
  );

  const ageMatch = calculateRangeMatch(
    modelAge,
    event.minAge,
    event.maxAge
  );

  const heightMatch = calculateRangeMatch(
    modelHeight,
    event.minHeight,
    event.maxHeight
  );

  const ageDifference =
    calculateRangeDifference(
      modelAge,
      event.minAge,
      event.maxAge
    );

  const heightDifference =
    calculateRangeDifference(
      modelHeight,
      event.minHeight,
      event.maxHeight
    );

  const locationMatch =
    calculateLocationMatch(
      model.location,
      event.location
    );

  const categoryOverlap =
    calculateOverlapScore(
      modelCategories,
      requiredCategories
    );

  const skillOverlap =
    calculateOverlapScore(
      modelSkills,
      requiredSkills
    );

  return {
    gender_match: genderMatch,
    age_difference: ageDifference,
    height_difference: heightDifference,
    location_match: locationMatch,
    category_overlap: categoryOverlap,
    skill_overlap: skillOverlap,
    age_match: ageMatch,
    height_match: heightMatch
  };
};

const getRecommendation = (score) => {
  if (score >= 85) {
    return 'Excellent compatibility';
  }

  if (score >= 70) {
    return 'Good compatibility';
  }

  if (score >= 50) {
    return 'Moderate compatibility';
  }

  return 'Low compatibility';
};

const calculateModelEventMatch = async (
  model,
  event
) => {
  const features = calculateModelEventFeatures(
    model,
    event
  );

  const prediction = await predictMatch(features);

  return {
  id: model._id,
  fullName: model.fullName || 'Unnamed Model',
  location: model.location || '',
  gender: model.gender || '',
  categories: model.categories || [],
  skills: model.skills || [],
  height: model.height || '',
  birthdate: model.birthdate || '',
  profileImage: model.profileImage || '',
  matchScore: prediction.score,
  recommendation: getRecommendation(
    prediction.score
  ),
  compatible: prediction.compatible
  };
};

const rankModelsForEvent = async (
  models,
  event
) => {
  const matches = await Promise.all(
    models.map((model) =>
      calculateModelEventMatch(
        model,
        event
      )
    )
  );

  return matches.sort(
    (a, b) =>
      b.matchScore - a.matchScore
  );
};

module.exports = {
  calculateModelEventMatch,
  rankModelsForEvent
};