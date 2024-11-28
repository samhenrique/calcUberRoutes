import sys
import pandas as pd
from joblib import load

# Carregar o modelo .pkl
model_path = "./uber_fare_model.pkl"
model = load(model_path)

# Receber argumentos de linha de comando (latitude/longitude)
origin, destination = sys.argv[1:]

# Criar o DataFrame para predição
example = pd.DataFrame({
    "pickup_h3": [origin],  # Garantir que os valores estão dentro de listas
    "dropoff_h3": [destination],  # Garantir que os valores estão dentro de listas
})

# Converter os valores H3 de hexadecimal para inteiro
example['pickup_h3'] = example['pickup_h3'].apply(lambda x: int(x, 16))
example['dropoff_h3'] = example['dropoff_h3'].apply(lambda x: int(x, 16))

# Fazer a predição
predicted_fare = model.predict(example)

# Retornar o valor previsto
print(predicted_fare[0])
