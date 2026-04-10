import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score, classification_report
import xgboost as xgb
import joblib
import os
import logging
from .feature_engineering import FeatureEngineer

logger = logging.getLogger(__name__)


class DelayPredictor:
    """
    XGBoost-based delay probability predictor with calibrated probabilities.
    """

    def __init__(self):
        self.feature_engineer = FeatureEngineer()
        self.model = xgb.XGBClassifier(
            n_estimators=300, max_depth=5, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8,
            min_child_weight=3, gamma=0.1,
            reg_alpha=0.1, reg_lambda=1.0,
            scale_pos_weight=1.0,
            random_state=42, n_jobs=-1,
            eval_metric='logloss', verbosity=0
        )
        self.trained = False
        self.metrics: dict = {}
        self.threshold: float = 0.5

    def train(self, df: pd.DataFrame) -> dict:
        logger.info("Training delay prediction model...")
        X = self.feature_engineer.fit_transform(df)
        y = df['is_delayed'].fillna(0).astype(int).values

        # Adjust pos weight for class imbalance
        pos_count = y.sum()
        neg_count = len(y) - pos_count
        if pos_count > 0:
            self.model.set_params(scale_pos_weight=neg_count / pos_count)

        self.model.fit(X, y)
        preds = self.model.predict(X)
        proba = self.model.predict_proba(X)[:, 1]

        self.metrics = {
            'accuracy': round(float(accuracy_score(y, preds)), 4),
            'f1': round(float(f1_score(y, preds)), 4),
            'auc': round(float(roc_auc_score(y, proba)), 4),
            'late_base_rate': round(float(y.mean()), 4),
        }
        self.trained = True
        logger.info(f"Delay model - AUC: {self.metrics['auc']}, F1: {self.metrics['f1']}")
        return self.metrics

    def predict(self, shipment: dict) -> dict:
        if not self.trained:
            raise RuntimeError("Model not trained.")

        df = pd.DataFrame([shipment])
        X = self.feature_engineer.transform(df)
        proba = float(self.model.predict_proba(X)[0][1])

        if proba < 0.30:
            risk_level = 'LOW'
            risk_color = '#00ff87'
        elif proba < 0.55:
            risk_level = 'MEDIUM'
            risk_color = '#fbbf24'
        elif proba < 0.75:
            risk_level = 'HIGH'
            risk_color = '#ff6b35'
        else:
            risk_level = 'CRITICAL'
            risk_color = '#ef4444'

        return {
            'delay_probability': round(proba * 100, 1),
            'risk_level': risk_level,
            'risk_color': risk_color,
            'is_predicted_delayed': proba >= self.threshold,
        }

    def get_feature_importance(self) -> list:
        if not self.trained or not hasattr(self.model, 'feature_importances_'):
            return []
        imp = self.model.feature_importances_
        names = self.feature_engineer.feature_names
        pairs = sorted(zip(names, imp.tolist()), key=lambda x: -x[1])[:12]
        return [{'feature': f, 'importance': round(v, 4)} for f, v in pairs]

    def save(self, path: str):
        os.makedirs(path, exist_ok=True)
        joblib.dump(self.model, os.path.join(path, 'delay_model.pkl'))
        joblib.dump(self.feature_engineer, os.path.join(path, 'delay_fe.pkl'))
        joblib.dump({'metrics': self.metrics, 'threshold': self.threshold},
                    os.path.join(path, 'delay_meta.pkl'))

    def load(self, path: str):
        p = os.path.join(path, 'delay_model.pkl')
        if os.path.exists(p):
            self.model = joblib.load(p)
        fe_p = os.path.join(path, 'delay_fe.pkl')
        if os.path.exists(fe_p):
            self.feature_engineer = joblib.load(fe_p)
        meta_p = os.path.join(path, 'delay_meta.pkl')
        if os.path.exists(meta_p):
            meta = joblib.load(meta_p)
            self.metrics = meta.get('metrics', {})
        self.trained = True
