import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score
import joblib
import sqlite3
import json

CSV_PATH = "real_estate_sample.csv"

def load_data():
    """Load data from SQLite database"""
    conn = sqlite3.connect('real_estate.db')
    query = """
    SELECT 
        building_size, rooms_count, total_floors_count, floor,
        has_elevator, has_parking, has_warehouse, has_balcony,
        construction_year, city_slug, price_value
    FROM real_estate
    WHERE price_value IS NOT NULL 
    AND building_size IS NOT NULL
    AND rooms_count IS NOT NULL
    """
    df = pd.read_sql_query(query, conn)
    conn.close()
    return df

def convert_persian_number(value):
    """Convert Persian number string to numeric value"""
    if pd.isna(value):
        return np.nan
    if isinstance(value, (int, float)):
        return value
        
    # Persian number mapping
    persian_numbers = {
        'صفر': 0, 'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4,
        'پنج': 5, 'شش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9,
        'ده': 10, 'یازده': 11, 'دوازده': 12, 'سیزده': 13,
        'چهارده': 14, 'پانزده': 15, 'شانزده': 16, 'هفده': 17,
        'هجده': 18, 'نوزده': 19, 'بیست': 20
    }
    
    # Convert strings to lower case
    value_str = str(value).strip().lower()
    
    # Check if it's a word number
    if value_str in persian_numbers:
        return persian_numbers[value_str]
    
    try:
        # extract numeric values from the string
        number = int(''.join(filter(str.isdigit, str(value))))
        return number
    except:
        return np.nan

def convert_persian_year(year_str):
    """Convert Persian year string to numeric year"""
    if pd.isna(year_str):
        return np.nan
    if isinstance(year_str, (int, float)):
        return year_str
    
    # Handle (before 1370)
    if 'قبل از' in str(year_str):
        return 1369  # One year before 1370
    
    try:
        # Try to extract numeric values
        year = int(''.join(filter(str.isdigit, str(year_str))))
        return year
    except:
        return np.nan

def preprocess_data(df):
    """Preprocess the data"""
    # Convert numeric columns from Persian text
    numeric_columns = ['rooms_count', 'total_floors_count', 'floor']
    for col in numeric_columns:
        df[col] = df[col].apply(convert_persian_number)
        df[col] = df[col].fillna(df[col].median())
        df[col] = df[col].astype(int)
    
    # Convert boolean columns to integers, handling string values and NaN
    bool_columns = ['has_elevator', 'has_parking', 'has_warehouse', 'has_balcony']
    for col in bool_columns:
        # Convert string boolean values to numeric
        df[col] = df[col].map({'true': 1, 'false': 0, True: 1, False: 0})
        # Fill NaN values with 0 (assuming missing amenities means they don't exist)
        df[col] = df[col].fillna(0)
        # Convert to integer
        df[col] = df[col].astype(int)
    
    # Handle construction year - convert Persian years to numeric
    df['construction_year'] = df['construction_year'].apply(convert_persian_year)
    df['construction_year'] = df['construction_year'].fillna(df['construction_year'].median())
    df['construction_year'] = df['construction_year'].astype(int)
    
    # Ensure building_size is numeric
    df['building_size'] = pd.to_numeric(df['building_size'], errors='coerce')
    df['building_size'] = df['building_size'].fillna(df['building_size'].median())
    
    # Drop remaining rows as NaN
    df = df.dropna()
    
    # Define features and target
    X = df.drop('price_value', axis=1)
    y = df['price_value']
    
    # Split the data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    return X_train, X_test, y_train, y_test, X.columns

def create_pipeline():
    """Create the preprocessing and modeling pipeline"""
    # Define numeric and categorical features
    numeric_features = ['building_size', 'rooms_count', 'total_floors_count', 
                       'floor', 'construction_year']
    categorical_features = ['city_slug']
    
    # Create transformers
    numeric_transformer = Pipeline(steps=[
        ('scaler', StandardScaler())
    ])
    
    categorical_transformer = Pipeline(steps=[
        ('onehot', OneHotEncoder(handle_unknown='ignore'))
    ])
    
    # Create column transformer
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numeric_features),
            ('cat', categorical_transformer, categorical_features)
        ])
    
    # Create the full pipeline
    pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('regressor', RandomForestRegressor(n_estimators=100, random_state=42))
    ])
    
    return pipeline

def train_model():
    """Train the model and save it"""
    print("Loading data...")
    df = load_data()
    
    print("Preprocessing data...")
    X_train, X_test, y_train, y_test, feature_names = preprocess_data(df)
    
    print("Creating pipeline...")
    pipeline = create_pipeline()
    
    print("Training model...")
    pipeline.fit(X_train, y_train)
    
    # Evaluate the model
    y_pred = pipeline.predict(X_test)
    mse = mean_squared_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    print(f"Model Performance:")
    print(f"Mean Squared Error: {mse:.2f}")
    print(f"R2 Score: {r2:.2f}")
    
    # Save the model
    joblib.dump(pipeline, 'real_estate_model.joblib')
    
    # Save feature names
    with open('feature_names.json', 'w') as f:
        json.dump(list(feature_names), f)
    
    print("Model saved successfully!")

if __name__ == "__main__":
    train_model() 