import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import h3
import joblib

# 1. Carregar os dados
# data = pd.DataFrame({
#     "fare_amount": [10.5, 12, 9, 9.3, 8.5, 5.7, 7.5, 7, 7.3, 8.5, 12.5, 33.3],
#     "pickup_longitude": [-73.984565, -73.991572, -74.000412, -73.991999, -73.966765, -73.970846, -73.986813, -73.993923, -73.999588, -73.951965, -73.994235, -73.874477],
#     "pickup_latitude": [40.745372, 40.749877, 40.71841, 40.719834, 40.761547, 40.763436, 40.725657, 40.758281, 40.73381, 40.777815, 40.751378, 40.774102],
#     "dropoff_longitude": [-73.951843, -73.964142, -73.999255, -73.983515, -73.990493, -73.981919, -73.999252, -74.005554, -74.015583, -73.947943, -73.984895, -73.983867],
#     "dropoff_latitude": [40.777743, 40.75718, 40.719967, 40.743818, 40.750787, 40.770281, 40.71378, 40.745134, 40.715692, 40.77622, 40.720365, 40.76961],
#     "passenger_count": [5, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 6]
# })
data = pd.read_csv("tmp/cleaned_2.csv", sep=";")

# Substituir vírgulas por pontos e converter para float
data['fare_amount'] = data['fare_amount'].str.replace(',', '.').astype(float)
data['pickup_latitude'] = data['pickup_latitude'].str.replace(',', '.').astype(float)
data['pickup_longitude'] = data['pickup_longitude'].str.replace(',', '.').astype(float)
data['dropoff_latitude'] = data['dropoff_latitude'].str.replace(',', '.').astype(float)
data['dropoff_longitude'] = data['dropoff_longitude'].str.replace(',', '.').astype(float)

# Filtrar latitudes e longitudes fora do intervalo permitido
valid_coords = (
    (data['pickup_latitude'].between(-90, 90)) &
    (data['pickup_longitude'].between(-180, 180)) &
    (data['dropoff_latitude'].between(-90, 90)) &
    (data['dropoff_longitude'].between(-180, 180))
)
data = data[valid_coords]

# Verifique valores ausentes
if data.isnull().any().any():
    print("Dados com valores ausentes encontrados.")
    print(data.isnull().sum())
    data = data.dropna()  # Remove linhas com NaN (se necessário)


print(data.head())

# 2. Converter coordenadas em identificadores H3
resolution = 15  # Resolução do H3 (ajustável)
data['pickup_h3'] = data.apply(
    lambda row: h3.latlng_to_cell(row['pickup_latitude'], row['pickup_longitude'], resolution), axis=1
)
data['dropoff_h3'] = data.apply(
    lambda row: h3.latlng_to_cell(row['dropoff_latitude'], row['dropoff_longitude'], resolution), axis=1
)

# 3. Selecionar features e target
X = data[['pickup_h3', 'dropoff_h3']]
y = data['fare_amount']

X['pickup_h3'] = X['pickup_h3'].apply(lambda x: int(x, 16))
X['dropoff_h3'] = X['dropoff_h3'].apply(lambda x: int(x, 16))

# 4. Dividir os dados em treino e teste
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 5. Treinar o modelo
model = RandomForestRegressor(random_state=42, n_estimators=100)
model.fit(X_train, y_train)

# 6. Avaliar o modelo
y_pred = model.predict(X_test)
print("Mean Absolute Error:", mean_absolute_error(y_test, y_pred))
print("R² Score:", r2_score(y_test, y_pred))

# 7. Fazer uma previsão
example = pd.DataFrame({
    "pickup_h3": [h3.latlng_to_cell(40.745372, -73.984565, resolution)],
    "dropoff_h3": [h3.latlng_to_cell(40.777743, -73.951843, resolution)],
})
# print(example, end="\n\n")

example['pickup_h3'] = example['pickup_h3'].apply(lambda example: int(example, 16))
example['dropoff_h3'] = example['dropoff_h3'].apply(lambda example: int(example, 16))

print(example)

predicted_fare = model.predict(example)
print("Preço previsto da corrida:", predicted_fare[0])

# Caminho para salvar o modelo
model_path = "uber_fare_model.pkl"

# Salvar o modelo
joblib.dump(model, model_path)
print(f"Modelo salvo em: {model_path}")