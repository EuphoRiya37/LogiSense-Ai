import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score, mean_squared_error
from sklearn.model_selection import train_test_split
import xgboost as xgb
import joblib
import os
import logging
from .feature_engineering import FeatureEngineer

logger = logging.getLogger(__name__)


class ETAPredictor:
    """
    Ensemble ETA predictor combining XGBoost, GradientBoosting, and Random Forest
    with weighted ensembling and test-set evaluation.
    Metrics are computed on a held-out test set, then all models are retrained on
    the full dataset for production inference.
    """

    def __init__(self):
        self.feature_engineer = FeatureEngineer()
        self.models = {
            'XGBoost': xgb.XGBRegressor(
                n_estimators=300,
                max_depth=6,
                learning_rate=0.05,
                subsample=0.8,
                colsample_bytree=0.8,
                min_child_weight=3,
                gamma=0.1,
                reg_alpha=0.1,
                reg_lambda=1.0,
                random_state=42,
                n_jobs=-1,
                verbosity=0
            ),
            'GradientBoost': GradientBoostingRegressor(
                n_estimators=200,
                learning_rate=0.07,
                subsample=0.8,
                min_samples_split=5,
                min_samples_leaf=3,
                max_depth=5,
                random_state=42
            ),
            'RandomForest': RandomForestRegressor(
                n_estimators=200,
                max_depth=12,
                min_samples_split=5,
                min_samples_leaf=3,
                random_state=42,
                n_jobs=-1
            ),
        }
        self.weights = {
            'XGBoost': 0.45,
            'GradientBoost': 0.35,
            'RandomForest': 0.20,
        }
        self.trained = False
        self.metrics: dict = {}
        self.residual_std: float = 1.0

    def train(self, df: pd.DataFrame) -> dict:
        logger.info("Training ETA prediction models...")

        if 'actual_shipping_days' not in df.columns:
            raise ValueError("Missing required target column: 'actual_shipping_days'")

        X = self.feature_engineer.fit_transform(df)
        y = df['actual_shipping_days'].fillna(df['actual_shipping_days'].median()).values

        if len(df) < 10:
            raise ValueError("Dataset too small to train reliably. Need at least 10 rows.")

        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=0.2,
            random_state=42
        )

        individual_metrics = {}
        ensemble_test_preds = np.zeros(len(y_test))
        test_pred_store = {}

        for name, model in self.models.items():
            model.fit(X_train, y_train)
            test_pred = model.predict(X_test)

            mae = mean_absolute_error(y_test, test_pred)
            r2 = r2_score(y_test, test_pred)
            rmse = np.sqrt(mean_squared_error(y_test, test_pred))

            individual_metrics[name] = {
                'mae': round(float(mae), 4),
                'r2': round(float(r2), 4),
                'rmse': round(float(rmse), 4),
            }

            test_pred_store[name] = test_pred
            ensemble_test_preds += test_pred * self.weights[name]

            logger.info(f"  {name} (test) - MAE: {mae:.3f}, R2: {r2:.3f}, RMSE: {rmse:.3f}")

        ensemble_residuals = y_test - ensemble_test_preds
        self.residual_std = float(np.std(ensemble_residuals))

        self.metrics = {
            'individual': individual_metrics,
            'ensemble': {
                'mae': round(float(mean_absolute_error(y_test, ensemble_test_preds)), 4),
                'r2': round(float(r2_score(y_test, ensemble_test_preds)), 4),
                'rmse': round(float(np.sqrt(mean_squared_error(y_test, ensemble_test_preds))), 4),
            },
            'train_size': int(len(y_train)),
            'test_size': int(len(y_test)),
        }

        logger.info(
            f"ETA Ensemble (test metrics) - "
            f"MAE: {self.metrics['ensemble']['mae']}, "
            f"R2: {self.metrics['ensemble']['r2']}, "
            f"RMSE: {self.metrics['ensemble']['rmse']}"
        )

        for name, model in self.models.items():
            model.fit(X, y)

        self.trained = True
        return self.metrics

    def predict(self, shipment: dict) -> dict:
        if not self.trained:
            raise RuntimeError("Model not trained. Call train() first.")

        df = pd.DataFrame([shipment])
        X = self.feature_engineer.transform(df)

        individual_preds = {}
        for name, model in self.models.items():
            individual_preds[name] = float(model.predict(X)[0])

        ensemble = sum(individual_preds[m] * self.weights[m] for m in self.models)
        ensemble = max(0.5, ensemble)

        ci_lower = max(0.5, ensemble - 1.645 * self.residual_std)
        ci_upper = ensemble + 1.645 * self.residual_std

        confidence_score = max(
            20.0,
            min(98.0, 100.0 - (self.residual_std / max(ensemble, 0.5) * 100))
        )

        return {
            'eta_days': round(ensemble, 1),
            'confidence_lower': round(ci_lower, 1),
            'confidence_upper': round(ci_upper, 1),
            'confidence_score': round(confidence_score, 1),
            'individual_predictions': {k: round(v, 2) for k, v in individual_preds.items()},
        }

    def predict_batch(self, shipments: list) -> list:
        results = []
        for s in shipments:
            try:
                results.append(self.predict(s))
            except Exception as e:
                results.append({'error': str(e), 'eta_days': None})
        return results

    def get_feature_importance(self) -> dict:
        if not self.trained:
            return {}

        result = {}
        for name, model in self.models.items():
            if hasattr(model, 'feature_importances_'):
                imp = model.feature_importances_
                feat_names = self.feature_engineer.feature_names
                pairs = sorted(zip(feat_names, imp.tolist()), key=lambda x: -x[1])[:15]
                result[name] = [{'feature': f, 'importance': round(v, 4)} for f, v in pairs]

        return result

    def save(self, path: str):
        os.makedirs(path, exist_ok=True)

        for name, model in self.models.items():
            joblib.dump(model, os.path.join(path, f'eta_{name.lower()}.pkl'))

        joblib.dump(self.feature_engineer, os.path.join(path, 'eta_fe.pkl'))
        joblib.dump(
            {
                'weights': self.weights,
                'residual_std': self.residual_std,
                'metrics': self.metrics,
            },
            os.path.join(path, 'eta_meta.pkl')
        )

    def load(self, path: str):
        for name in list(self.models.keys()):
            p = os.path.join(path, f'eta_{name.lower()}.pkl')
            if os.path.exists(p):
                self.models[name] = joblib.load(p)

        fe_path = os.path.join(path, 'eta_fe.pkl')
        if os.path.exists(fe_path):
            self.feature_engineer = joblib.load(fe_path)

        meta_path = os.path.join(path, 'eta_meta.pkl')
        if os.path.exists(meta_path):
            meta = joblib.load(meta_path)
            self.residual_std = meta.get('residual_std', 1.0)
            self.metrics = meta.get('metrics', {})
            self.weights = meta.get('weights', self.weights)

        self.trained = True