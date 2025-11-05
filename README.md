# Aqari Al Dhaki – Apartment Price Prediction Platform
<img width="1918" height="950" alt="image" src="https://github.com/user-attachments/assets/3f1048f6-217c-4cde-9858-1d9e99c4d1b2" />


Aqari Al Dhaki is an AI-powered platform designed to predict apartment prices in Palestinian cities. By leveraging machine learning models trained on apartment data, the platform provides price estimates and insights into the factors influencing apartment prices. It also helps users evaluate whether a listed price is fair, overpriced, or suspicious.

## Overview
- **Price Prediction**: Predict the price of an apartment based on features like area, number of rooms, bathrooms, building age, and location.  
- **Market Analysis**: Compare a listed price with the predicted market range to determine its fairness and identify potential deals.  
- **Interactive Insights**: Understand the key factors influencing the predicted price, such as location, apartment size, and amenities.

## Technologies Used
- **Frontend**: HTML, CSS, JavaScript  
- **Backend**: FastAPI  
- **Machine Learning**: XGBoost, scikit-learn  
- **Data Analysis**: pandas, NumPy  
- **Visualization**: Matplotlib, Seaborn  
- **Web Scraping**: Selenium, BeautifulSoup

## Setup & Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/AlaaArmoush/Aqari-Al-Dhaki.git
   cd Aqari-Al-Dhaki
   ```

2. Create and activate a virtual environment if you don't already have one (recommended).
   The examples below create a .venv folder inside the project; change the name if you prefer another location.

   **On macOS / Linux**
   ```bash
   # create venv if it doesn't exist
   python3 -m venv .venv
   # activate
   source .venv/bin/activate
   ```

   **On Windows (PowerShell)**
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

   **On Windows (CMD)**
   ```cmd
   python -m venv .venv
   .\.venv\Scripts\activate
   ```

   (If you already use a different virtual environment name or manager such as conda/pipenv, activate that instead.)

3. Upgrade pip and install dependencies:
   ```bash
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. Run the backend server:
   ```bash
   # Example using port 8000
   uvicorn app:app --reload --port 8000
   ```

5. Open the frontend:
   Navigate to http://127.0.0.1:8000 in your browser
   (replace 8000 with the port you used)

## Usage

### Predict Price
- Fill in the apartment details in the form on the homepage (area, rooms, bathrooms, building age, location, etc.).
- Click **Predict Price** to get the estimated price and a breakdown of contributing factors.

### Judge Price
- In the **Compare with Listed Price** section, enter the listed price of an apartment.
- Click **Judge** to analyze whether the price is fair or not.

## License
MIT License
