import pandas as pd
import joblib

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report


# Load training data
data = pd.read_csv("training_data.csv")


# Features used by the AI model
features = [
    "gender_match",
    "age_difference",
    "height_difference",
    "location_match",
    "category_overlap",
    "skill_overlap",
    "age_match",
    "height_match"
]


X = data[features]
y = data["compatible"]


# Split data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)


# Create Random Forest classifier
model = RandomForestClassifier(
    n_estimators=100,
    random_state=42,
    max_depth=8
)


# Train the model
model.fit(X_train, y_train)


# Test the model
predictions = model.predict(X_test)

accuracy = accuracy_score(y_test, predictions)

print("Random Forest model trained successfully.")
print(f"Training records: {len(X_train)}")
print(f"Testing records: {len(X_test)}")
print(f"Accuracy: {accuracy * 100:.2f}%")

print("\nClassification Report:")
print(classification_report(y_test, predictions))


# Save trained model
model_file = "random_forest_model.joblib"

joblib.dump(model, model_file)

print(f"\nModel saved as: {model_file}")