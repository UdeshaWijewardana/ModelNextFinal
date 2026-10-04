import joblib
import pandas as pd


# Load the trained Random Forest model
model = joblib.load("random_forest_model.joblib")


# Example model-event compatibility data
test_data = pd.DataFrame([
    {
        "gender_match": 1,
        "age_difference": 2,
        "height_difference": 4,
        "location_match": 1,
        "category_overlap": 1.0,
        "skill_overlap": 0.8,
        "age_match": 1,
        "height_match": 1
    }
])


# Predict compatibility
prediction = model.predict(test_data)[0]

# Get probability of being compatible
probability = model.predict_proba(test_data)[0][1]


print("AI prediction completed.")
print(f"Compatible: {'Yes' if prediction == 1 else 'No'}")
print(f"Compatibility probability: {probability * 100:.2f}%")