@echo off
TITLE MeetFlow API Server
COLOR 0B

:: Navegar al directorio donde se encuentra el archivo .bat
cd /d "%~dp0"

echo =========================================================
echo           MEETFLOW API - SISTEMA DE ARRANQUE
echo =========================================================
echo.

:: Verificar si existe node_modules
IF NOT EXIST node_modules (
    echo [AVISO] No se encontro la carpeta node_modules.
    echo [INFO] Instalando dependencias necesarias...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Hubo un problema al instalar las dependencias.
        pause
        exit /b %ERRORLEVEL%
    )
)

:: Generar el cliente de Prisma por si acaso hay cambios en el schema
echo [INFO] Sincronizando Prisma Client...
call npx prisma generate

:: Preguntar si se desea limpiar la base de datos
set /p reset_db="? Deseas limpiar/resetear la base de datos? (S/N): "
if /i "%reset_db%"=="S" (
    echo [PELIGRO] Reseteando la base de datos...
    call npx prisma migrate reset --force
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Hubo un problema al resetear la base de datos.
        echo [INFO] Es posible que no tengas migraciones creadas todavia.
        echo [INFO] Intentando con db push reset...
        call npx prisma db push --force-reset
    )
)

echo.
echo =========================================================
echo [OK] Todo listo. Iniciando el servidor en modo DEV...
echo =========================================================
echo.

:: Ejecutar el script de desarrollo definido en package.json
call npm run dev

:: En caso de que el proceso se detenga, mantener la ventana abierta
echo.
echo [INFO] El servidor se ha detenido.
pause
