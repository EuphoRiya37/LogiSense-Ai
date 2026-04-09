import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder
from typing import Optional


class FeatureEngineer:
    def __init__(self):
        self.encoders: dict = {}
        self.feature_names: list = []
        self.fitted: bool = False

    SHIPPING_SPEED = {
        'Same Day': 1, 'First Class': 2, 'Second Class': 3, 'Standard Class': 4
    }

    CATEGORICAL_COLS = [
        'shipping_mode', 'order_region', 'category_name',
        'customer_segment', 'market', 'payment_type', 'order_country'
    ]

    NUMERIC_COLS = [
        'quantity', 'sales', 'order_total', 'profit',
        'scheduled_shipping_days', 'discount_rate', 'profit_ratio', 'benefit_per_order'
    ]

    def fit_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        result = self._build_features(df, fit=True)
        self.fitted = True
        return result

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        return self._build_features(df, fit=False)

    def _build_features(self, df: pd.DataFrame, fit: bool) -> pd.DataFrame:
        result = pd.DataFrame(index=df.index)

        # --- Numeric features ---
        for col in self.NUMERIC_COLS:
            if col in df.columns:
                result[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

        # --- Date/time features ---
        date_cols = ['order_day_of_week', 'order_month', 'order_quarter', 'order_year']
        for col in date_cols:
            if col in df.columns:
                result[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

        # Cyclical time encoding - captures periodicity
        if 'order_day_of_week' in result.columns:
            result['dow_sin'] = np.sin(2 * np.pi * result['order_day_of_week'] / 7)
            result['dow_cos'] = np.cos(2 * np.pi * result['order_day_of_week'] / 7)

        if 'order_month' in result.columns:
            result['month_sin'] = np.sin(2 * np.pi * result['order_month'] / 12)
            result['month_cos'] = np.cos(2 * np.pi * result['order_month'] / 12)

        # --- Shipping mode speed proxy ---
        if 'shipping_mode' in df.columns:
            result['shipping_speed'] = df['shipping_mode'].map(self.SHIPPING_SPEED).fillna(3)

        # --- Geographic features ---
        if 'latitude' in df.columns and 'longitude' in df.columns:
            lat = pd.to_numeric(df['latitude'], errors='coerce').fillna(39.5)
            lon = pd.to_numeric(df['longitude'], errors='coerce').fillna(-98.0)
            result['latitude'] = lat
            result['longitude'] = lon
            # Distance from US center as rough delivery distance proxy
            result['geo_distance_proxy'] = np.sqrt((lat - 39.5) ** 2 + (lon - (-98.0)) ** 2)
            # Hemisphere flags
            result['is_north_hemisphere'] = (lat > 0).astype(int)
            result['is_western_hemisphere'] = (lon < 0).astype(int)

        # --- Categorical encoding ---
        for col in self.CATEGORICAL_COLS:
            if col in df.columns:
                series = df[col].fillna('Unknown').astype(str)
                if fit:
                    le = LabelEncoder()
                    result[f'{col}_enc'] = le.fit_transform(series)
                    self.encoders[col] = le
                else:
                    if col in self.encoders:
                        le = self.encoders[col]
                        known = set(le.classes_)
                        result[f'{col}_enc'] = series.apply(
                            lambda x: le.transform([x])[0] if x in known else 0
                        )
                    else:
                        result[f'{col}_enc'] = 0

        # --- Interaction features ---
        if 'shipping_speed' in result.columns and 'scheduled_shipping_days' in result.columns:
            result['speed_x_scheduled'] = result['shipping_speed'] * result['scheduled_shipping_days']

        if 'quantity' in result.columns and 'order_total' in result.columns:
            result['value_per_unit'] = result['order_total'] / (result['quantity'] + 1)

        self.feature_names = list(result.columns)
        # fillna before astype to avoid NA cast issues in pandas 3.x
        result = result.fillna(0.0)
        return result.astype(float)
