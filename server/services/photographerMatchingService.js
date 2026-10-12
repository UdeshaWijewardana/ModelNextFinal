
const normalize = (value) =>
  String(value || "").trim().toLowerCase();

const hasValue = (value) => {
  if (value === null || value === undefined) return false;

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasValue(item));
  }

  return true;
};

const normalizeArray = (value) => {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === "string")
      .map(normalize)
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map(normalize)
      .filter(Boolean);
  }

  return [];
};

/**
 * Weights:
 * Required skills:     35%
 * Photography styles: 30%
 * Experience:          25%
 * Location:            10%
 *
 * Missing criteria contribute zero points.
 * Their weights are not redistributed.
 */
const calculateWeightedScore = (criteria) => {
  let earnedPoints = 0;
  let hasScoredCriterion = false;

  for (const { score, weight } of criteria) {
    if (
      score === null ||
      score === undefined ||
      !Number.isFinite(score)
    ) {
      continue;
    }

    hasScoredCriterion = true;

    const safeScore = Math.max(0, Math.min(100, score));

    earnedPoints += (safeScore * weight) / 100;
  }

  if (!hasScoredCriterion) {
    return null;
  }

  return Math.round(earnedPoints);
};

/**
 * Photography style match: 30%.
 *
 * Exact match: 100
 * Partial match: 70
 * No match: 0
 */
const calculateStyleScore = (photographer, event) => {
  const photographerStyles = normalizeArray(
    photographer.photographyStyles
  );

  const requiredStyle = normalize(event.eventType);

  if (!photographerStyles.length || !requiredStyle) {
    return null;
  }

  if (photographerStyles.includes(requiredStyle)) {
    return 100;
  }

  const partialMatch = photographerStyles.some(
    (style) =>
      style.includes(requiredStyle) ||
      requiredStyle.includes(style)
  );

  return partialMatch ? 70 : 0;
};

/**
 * Required skills match: 35%.
 *
 * Each required skill contributes an equal share of 35%.
 *
 * Example:
 * 3 required skills, 2 matched:
 * (2 / 3) * 35 = 23.33 points.
 */
const calculateSkillsScore = (photographer, event) => {
  const required = [
    ...new Set(normalizeArray(event.requiredSkills)),
  ];

  const available = new Set(
    normalizeArray(photographer.skills)
  );

  if (!required.length || available.size === 0) {
    return null;
  }

  const matchedCount = required.filter((skill) =>
    available.has(skill)
  ).length;

  return Math.round((matchedCount / required.length) * 100);
};

/**
 * Experience match: 25%.
 *
 * More experience earns a higher score.
 *
 * If the event specifies minimum experience:
 * full experience points are reached at twice the
 * required years, with a minimum benchmark of 10 years.
 *
 * If no minimum is specified:
 * 10 years earns full experience points.
 */
const calculateExperienceScore = (photographer, event) => {
  const experience = photographer.experienceYears;

  if (
    experience === null ||
    experience === undefined ||
    experience === "" ||
    !Number.isFinite(Number(experience)) ||
    Number(experience) < 0
  ) {
    return null;
  }

  const years = Number(experience);
  const requiredYears = Number(event.minExperienceYears);

  const hasRequiredYears =
    event.minExperienceYears !== null &&
    event.minExperienceYears !== undefined &&
    event.minExperienceYears !== "" &&
    Number.isFinite(requiredYears) &&
    requiredYears > 0;

  const experienceBenchmark = hasRequiredYears
    ? Math.max(10, requiredYears * 2)
    : 10;

  return Math.min(
    100,
    Math.round((years / experienceBenchmark) * 100)
  );
};

/**
 * Location match: 10%.
 *
 * Exact match: 100
 * Partial match: 70
 * Different locations: 0
 */
const calculateLocationScore = (photographer, event) => {
  if (
    !hasValue(photographer.location) ||
    !hasValue(event.location)
  ) {
    return null;
  }

  const photographerLocation = normalize(
    photographer.location
  );

  const eventLocation = normalize(event.location);

  if (photographerLocation === eventLocation) {
    return 100;
  }

  if (
    photographerLocation.includes(eventLocation) ||
    eventLocation.includes(photographerLocation)
  ) {
    return 70;
  }

  return 0;
};

/**
 * Recommendation label.
 */
const getRecommendation = (score) => {
  if (score === null) {
    return "Insufficient profile information";
  }

  if (score >= 85) return "Excellent compatibility";
  if (score >= 70) return "Good compatibility";
  if (score >= 50) return "Moderate compatibility";

  return "Low compatibility";
};

/**
 * Calculate an individual photographer's event match.
 */
const calculatePhotographerMatch = (photographer, event) => {
  const styleScore = calculateStyleScore(
    photographer,
    event
  );

  const skillsScore = calculateSkillsScore(
    photographer,
    event
  );

  const experienceScore = calculateExperienceScore(
    photographer,
    event
  );

  const locationScore = calculateLocationScore(
    photographer,
    event
  );

  const criteria = [
    { score: skillsScore, weight: 35 },
    { score: styleScore, weight: 30 },
    { score: experienceScore, weight: 25 },
    { score: locationScore, weight: 10 },
  ];

  const matchScore = calculateWeightedScore(criteria);

  return {
    id: photographer._id.toString(),

    fullName: photographer.name || "Unnamed Photographer",
    location: photographer.location || "",
    profileImage: photographer.profileImage || "",
    portfolio: photographer.portfolio || "",
    experienceYears: photographer.experienceYears ?? null,

    photographyStyles: normalizeArray(
      photographer.photographyStyles
    ),

    skills: normalizeArray(photographer.skills),

    matchScore,
    recommendation: getRecommendation(matchScore),
    compatible: matchScore !== null && matchScore >= 70,
    role: "photographer",

    scoreBreakdown: {
      photographyStyle: styleScore,
      requiredSkills: skillsScore,
      experience: experienceScore,
      location: locationScore,
    },
  };
};

/**
 * Rank photographers from highest to lowest match score.
 */
const rankPhotographersForEvent = (photographers, event) => {
  const matches = photographers.map((photographer) =>
    calculatePhotographerMatch(photographer, event)
  );

  return matches.sort((a, b) => {
    if (a.matchScore === null && b.matchScore !== null) {
      return 1;
    }

    if (b.matchScore === null && a.matchScore !== null) {
      return -1;
    }

    if (a.matchScore === null && b.matchScore === null) {
      return 0;
    }

    return b.matchScore - a.matchScore;
  });
};

module.exports = {
  calculatePhotographerMatch,
  rankPhotographersForEvent,
};
