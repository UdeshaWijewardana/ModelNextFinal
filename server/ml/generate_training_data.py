import random
import pandas as pd

random.seed(42)

ROWS = 2000
data = []

for _ in range(ROWS):

    gender_match = random.randint(0, 1)

    age_difference = random.randint(0, 15)

    height_difference = random.randint(0, 20)

    location_match = random.randint(0, 1)

    category_overlap = round(random.uniform(0, 1), 2)

    skill_overlap = round(random.uniform(0, 1), 2)

    age_match = 1 if age_difference <= 5 else 0

    height_match = 1 if height_difference <= 10 else 0

    # Synthetic compatibility rule
    compatibility_score = (
        gender_match * 0.15
        + age_match * 0.15
        + height_match * 0.15
        + location_match * 0.15
        + category_overlap * 0.25
        + skill_overlap * 0.15
    )

    compatible = 1 if compatibility_score >= 0.55 else 0

    data.append({
        "gender_match": gender_match,
        "age_difference": age_difference,
        "height_difference": height_difference,
        "location_match": location_match,
        "category_overlap": category_overlap,
        "skill_overlap": skill_overlap,
        "age_match": age_match,
        "height_match": height_match,
        "compatible": compatible
    })


df = pd.DataFrame(data)

output_file = "training_data.csv"

df.to_csv(output_file, index=False)

print(f"Training dataset created: {output_file}")
print(f"Number of records: {len(df)}")
print("\nClass distribution:")
print(df["compatible"].value_counts())

print("\nFirst 5 records:")
print(df.head())