\getenv app_password APP_DB_PASSWORD
CREATE ROLE requirements_app LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE requirements TO requirements_app;
