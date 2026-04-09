import pandas as pd
import numpy as np
import os
import logging

logger = logging.getLogger(__name__)

class DataLoader:
    def __init__(self, data_path: str):
        self.data_path = data_path
        self.df = None
        self._load()

    def _load(self):
        if os.path.exists(self.data_path):
            try:
                self.df = pd.read_csv(self.data_path, encoding='latin-1')
                logger.info(f"Loaded {len(self.df)} rows from {self.data_path}")
                self._preprocess()
            except Exception as e:
                logger.warning(f"Error loading CSV: {e}. Generating synthetic data.")
                self.df = self._generate_synthetic()
        else:
            logger.warning(f"Data file not found at {self.data_path}. Generating synthetic data.")
            self.df = self._generate_synthetic()

    def _preprocess(self):
        df = self.df
        col_map = {
            'Days for shipping (real)': 'actual_shipping_days',
            'Days for shipment (scheduled)': 'scheduled_shipping_days',
            'Delivery Status': 'delivery_status',
            'Late_delivery_risk': 'late_delivery_risk',
            'Shipping Mode': 'shipping_mode',
            'Order Region': 'order_region',
            'Order Country': 'order_country',
            'Market': 'market',
            'Latitude': 'latitude',
            'Longitude': 'longitude',
            'Type': 'payment_type',
            'Category Name': 'category_name',
            'Department Name': 'department_name',
            'Customer Segment': 'customer_segment',
            'Order Item Quantity': 'quantity',
            'Sales': 'sales',
            'Order Item Total': 'order_total',
            'Order Profit Per Order': 'profit',
            'order date (DateOrders)': 'order_date',
            'shipping date (DateOrders)': 'ship_date',
            'Order City': 'order_city',
            'Order State': 'order_state',
            'Customer City': 'customer_city',
            'Customer Country': 'customer_country',
            'Product Name': 'product_name',
            'Order Item Discount Rate': 'discount_rate',
            'Order Item Profit Ratio': 'profit_ratio',
            'Benefit per order': 'benefit_per_order',
        }
        for old_col, new_col in col_map.items():
            if old_col in df.columns:
                df.rename(columns={old_col: new_col}, inplace=True)

        for date_col in ['order_date', 'ship_date']:
            if date_col in df.columns:
                df[date_col] = pd.to_datetime(df[date_col], errors='coerce')

        if 'order_date' in df.columns:
            df['order_day_of_week'] = df['order_date'].dt.dayofweek
            df['order_month'] = df['order_date'].dt.month
            df['order_year'] = df['order_date'].dt.year
            df['order_quarter'] = df['order_date'].dt.quarter

        if 'actual_shipping_days' in df.columns and 'scheduled_shipping_days' in df.columns:
            df['delay_days'] = df['actual_shipping_days'] - df['scheduled_shipping_days']
            df['is_delayed'] = (df['delay_days'] > 0).astype(int)

        if 'latitude' not in df.columns or df.get('latitude', pd.Series()).isna().all():
            region_coords = {
                'Western Europe': (48.8, 9.0), 'Central America': (15.0, -86.0),
                'South America': (-14.0, -55.0), 'Southeast Asia': (10.0, 106.0),
                'North America': (39.5, -98.0), 'Eastern Europe': (52.0, 25.0),
                'West of USA': (37.0, -119.0), 'East of USA': (40.0, -74.0),
                'Western Africa': (9.0, -11.0), 'Eastern Africa': (-1.0, 36.0),
            }
            lats, lons = [], []
            for _, row in df.iterrows():
                region = row.get('order_region', 'North America')
                base = region_coords.get(region, (39.5, -98.0))
                lats.append(base[0] + np.random.uniform(-5, 5))
                lons.append(base[1] + np.random.uniform(-5, 5))
            df['latitude'] = lats
            df['longitude'] = lons

        essential_cols = [c for c in ['actual_shipping_days', 'shipping_mode'] if c in df.columns]
        df.dropna(subset=essential_cols, inplace=True)
        df.reset_index(drop=True, inplace=True)
        self.df = df

    def _generate_synthetic(self) -> pd.DataFrame:
        np.random.seed(42)
        n = 12000
        shipping_modes = ['Standard Class', 'Second Class', 'First Class', 'Same Day']
        shipping_params = {
            'Standard Class': (6, 2.5), 'Second Class': (4, 1.5),
            'First Class': (2, 1.0), 'Same Day': (1, 0.3)
        }
        regions = ['North America', 'Western Europe', 'Central America',
                   'South America', 'Southeast Asia', 'Eastern Europe',
                   'Western Africa', 'East of USA']
        region_coords = {
            'North America': (39.5, -98.0), 'Western Europe': (48.8, 9.0),
            'Central America': (15.0, -86.0), 'South America': (-14.0, -55.0),
            'Southeast Asia': (10.0, 106.0), 'Eastern Europe': (52.0, 25.0),
            'Western Africa': (9.0, -11.0), 'East of USA': (40.0, -74.0),
        }
        categories = ['Electronics', 'Clothing', 'Furniture', 'Sports',
                      'Books', 'Food', 'Automotive', 'Health & Beauty']
        segments = ['Consumer', 'Corporate', 'Home Office']
        markets = ['US', 'Europe', 'LATAM', 'APAC', 'Africa']
        payment_types = ['DEBIT', 'TRANSFER', 'CASH', 'PAYMENT']
        delivery_statuses = ['Advance shipping', 'Late delivery',
                             'Shipping canceled', 'Shipping on time']

        modes = np.random.choice(shipping_modes, n)
        order_regions = np.random.choice(regions, n)
        scheduled = np.array([
            max(1, int(np.random.normal(shipping_params[m][0], shipping_params[m][1])))
            for m in modes
        ])

        # Seasonal + regional delay effect
        months = np.random.randint(1, 13, n)
        dow = np.random.randint(0, 7, n)
        delay_noise = np.random.normal(0.3, 1.2, n)
        seasonal_factor = np.where((months == 12) | (months == 11), 1.5, 1.0)
        actual = np.maximum(1, scheduled + (delay_noise * seasonal_factor).astype(int))

        delay_days = actual - scheduled
        is_delayed = (delay_days > 0).astype(int)

        # Status
        status = []
        for d in delay_days:
            if d < -1:
                status.append('Advance shipping')
            elif d <= 0:
                status.append('Shipping on time')
            elif d <= 3:
                status.append('Late delivery')
            else:
                status.append('Late delivery')

        lats, lons = [], []
        for r in order_regions:
            base = region_coords.get(r, (39.5, -98.0))
            lats.append(base[0] + np.random.uniform(-8, 8))
            lons.append(base[1] + np.random.uniform(-8, 8))

        years = np.random.choice([2015, 2016, 2017], n, p=[0.3, 0.4, 0.3])

        return pd.DataFrame({
            'actual_shipping_days': actual,
            'scheduled_shipping_days': scheduled,
            'delay_days': delay_days,
            'is_delayed': is_delayed,
            'delivery_status': status,
            'late_delivery_risk': is_delayed,
            'shipping_mode': modes,
            'order_region': order_regions,
            'order_country': np.random.choice(['USA', 'France', 'Germany', 'Mexico', 'Brazil', 'China'], n),
            'category_name': np.random.choice(categories, n),
            'customer_segment': np.random.choice(segments, n),
            'market': np.random.choice(markets, n),
            'payment_type': np.random.choice(payment_types, n),
            'quantity': np.random.randint(1, 50, n),
            'sales': np.round(np.random.uniform(10, 5000, n), 2),
            'order_total': np.round(np.random.uniform(10, 5000, n), 2),
            'profit': np.round(np.random.uniform(-100, 800, n), 2),
            'discount_rate': np.round(np.random.uniform(0, 0.5, n), 3),
            'profit_ratio': np.round(np.random.uniform(-0.2, 0.6, n), 3),
            'benefit_per_order': np.round(np.random.uniform(-50, 300, n), 2),
            'latitude': lats,
            'longitude': lons,
            'order_day_of_week': dow,
            'order_month': months,
            'order_year': years,
            'order_quarter': ((months - 1) // 3) + 1,
        })

    def get_dataframe(self) -> pd.DataFrame:
        return self.df

    def get_summary_stats(self) -> dict:
        df = self.df
        stats = {
            'total_shipments': int(len(df)),
            'on_time_rate': float(round((1 - df['is_delayed'].mean()) * 100, 1)) if 'is_delayed' in df.columns else 75.0,
            'avg_delay_days': float(round(df['delay_days'].mean(), 2)) if 'delay_days' in df.columns else 1.2,
            'avg_shipping_days': float(round(df['actual_shipping_days'].mean(), 1)) if 'actual_shipping_days' in df.columns else 5.0,
            'late_rate': float(round(df['is_delayed'].mean() * 100, 1)) if 'is_delayed' in df.columns else 25.0,
            'total_revenue': float(round(df['sales'].sum(), 0)) if 'sales' in df.columns else 0,
            'avg_order_value': float(round(df['sales'].mean(), 2)) if 'sales' in df.columns else 0,
        }

        if 'shipping_mode' in df.columns:
            stats['shipping_mode_dist'] = df['shipping_mode'].value_counts().to_dict()

        if 'delivery_status' in df.columns:
            stats['delivery_status_dist'] = df['delivery_status'].value_counts().to_dict()

        if 'order_region' in df.columns and 'is_delayed' in df.columns:
            delay_by_region = df.groupby('order_region', observed=False)['is_delayed'].mean().round(3).to_dict()
            stats['delay_by_region'] = {str(k): float(v) for k, v in delay_by_region.items()}

        if 'category_name' in df.columns and 'is_delayed' in df.columns:
            raw = df.groupby('category_name', observed=False)['is_delayed'].mean().round(3).to_dict()
            stats['delay_by_category'] = {str(k): float(v) for k, v in raw.items()}

        if 'order_day_of_week' in df.columns and 'is_delayed' in df.columns:
            dow_map = {0: 'Mon', 1: 'Tue', 2: 'Wed', 3: 'Thu', 4: 'Fri', 5: 'Sat', 6: 'Sun'}
            dow_delay = df.groupby('order_day_of_week', observed=False)['is_delayed'].mean()
            stats['delay_by_dow'] = {dow_map.get(int(k), str(k)): float(round(v, 3)) for k, v in dow_delay.items()}

        if 'order_month' in df.columns and 'is_delayed' in df.columns:
            raw = df.groupby('order_month', observed=False)['is_delayed'].mean()
            stats['delay_by_month'] = {int(k): float(round(v, 3)) for k, v in raw.items()}

        return stats

    def get_shipping_trends(self) -> list:
        df = self.df
        if 'order_month' not in df.columns or 'order_year' not in df.columns:
            return []
        try:
            agg_dict: dict = {'actual_shipping_days': ['count', 'mean']}
            if 'is_delayed' in df.columns:
                agg_dict['is_delayed'] = 'mean'
            if 'sales' in df.columns:
                agg_dict['sales'] = 'mean'

            grouped = df.groupby(['order_year', 'order_month'], observed=False).agg(agg_dict)
            grouped.columns = ['_'.join(c).strip('_') for c in grouped.columns]
            grouped = grouped.reset_index()

            col_renames = {
                'actual_shipping_days_count': 'total',
                'actual_shipping_days_mean': 'avg_days',
                'is_delayed_mean': 'late_pct',
                'sales_mean': 'avg_sales',
            }
            grouped.rename(columns=col_renames, inplace=True)
            grouped['label'] = grouped['order_year'].astype(str) + '-' + grouped['order_month'].astype(str).str.zfill(2)

            for col in ['total', 'avg_days', 'late_pct', 'avg_sales']:
                if col in grouped.columns:
                    grouped[col] = grouped[col].fillna(0).round(3)

            return grouped.sort_values(['order_year', 'order_month']).tail(24).to_dict(orient='records')
        except Exception as e:
            logger.warning(f"get_shipping_trends error: {e}")
            return []

    def get_mode_performance(self) -> list:
        df = self.df
        if 'shipping_mode' not in df.columns:
            return []
        try:
            agg_dict: dict = {'actual_shipping_days': ['count', 'mean']}
            if 'is_delayed' in df.columns:
                agg_dict['is_delayed'] = 'mean'
            if 'delay_days' in df.columns:
                agg_dict['delay_days'] = 'mean'
            if 'profit' in df.columns:
                agg_dict['profit'] = 'mean'

            perf = df.groupby('shipping_mode', observed=False).agg(agg_dict)
            perf.columns = ['_'.join(c).strip('_') for c in perf.columns]
            perf = perf.reset_index()

            col_renames = {
                'actual_shipping_days_count': 'count',
                'actual_shipping_days_mean': 'avg_days',
                'is_delayed_mean': 'late_rate',
                'delay_days_mean': 'avg_delay',
                'profit_mean': 'avg_profit',
            }
            perf.rename(columns=col_renames, inplace=True)
            for col in ['count', 'avg_days', 'late_rate', 'avg_delay', 'avg_profit']:
                if col in perf.columns:
                    perf[col] = perf[col].fillna(0).round(4)
            return perf.to_dict(orient='records')
        except Exception as e:
            logger.warning(f"get_mode_performance error: {e}")
            return []
