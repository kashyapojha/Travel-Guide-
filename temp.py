import requests

# Replace with your actual API key
API_KEY = "17d6f3d4dcb32aad6e8d360b0a907e66"

# Replace with your desired coordinates
lat = 40.7128  # Example: New York latitude
lon = -74.0060  # Example: New York longitude
cnt = 16

# Build the API URL
url = f"https://api.openweathermap.org/data/2.5/forecast?q=London&appid=YOUR_API_KEY&units=metric"

try:
    response = requests.get(url)
    response.raise_for_status()  # Raise an error for bad status codes
    data = response.json()
    
    # Extract some useful information
    city = data.get("name")
    weather = data.get("weather")[0].get("description")
    temperature = data.get("main").get("temp")
    
    print(f"City: {city}")
    print(f"Weather: {weather}")
    print(f"Temperature: {temperature}°C")

except requests.exceptions.HTTPError as http_err:
    print(f"HTTP error occurred: {http_err}")
except Exception as err:
    print(f"An error occurred: {err}")
