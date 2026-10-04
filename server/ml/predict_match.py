import sys
import json
import joblib
import pandas as pd


model = joblib.load("random_forest_model.joblib")


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "No input data provided."
        }))
        sys.exit(1)

    try:
        input_data = json.loads(sys.argv[1])

        data = pd.DataFrame([input_data])

        prediction = model.predict(data)[0]

        probability = model.predict_proba(data)[0][1]

        result = {
            "compatible": bool(prediction),
            "score": round(float(probability) * 100, 2)
        }

        print(json.dumps(result))

    except Exception as error:
        print(json.dumps({
            "error": str(error)
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()