# MeetFlow API - Guía Completa 🚀

Este documento contiene las instrucciones para levantar el servidor tanto de forma local (para
pruebas) como en producción (Render).

---

## 💻 Guía de Inicio Rápido (Desarrollo Local)

Sigue estos pasos en orden para ejecutar el servidor en tu computadora:

### 1. Instalar Dependencias

Abre una terminal en la carpeta `API` y ejecuta:

```bash
npm install
```

*Esto descargará todas las librerías necesarias.*

### 2. Configurar Variables de Entorno

Crea un archivo llamado `.env` dentro de la carpeta `API` y pega lo siguiente (ajusta los valores
según tu base de datos local):

```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/meetflow"
JWT_SECRET="una_clave_secreta_muy_larga_y_segura"
CLOUDINARY_CLOUD_NAME="tu_nombre_de_cloud"
CLOUDINARY_API_KEY="tu_api_key"
CLOUDINARY_API_SECRET="tu_api_secret"
```

### 3. Sincronizar Base de Datos

Ejecuta el siguiente comando para crear las tablas en tu base de datos:

```bash
npx prisma db push
```

### 4. Iniciar Servidor de Desarrollo

Finalmente, arranca el motor:

```bash
npm run dev
```

*Si todo está bien, verás: "Server is running on port 3000".*

---

## 🌐 Despliegue en Producción (Render)

### 1. Base de Datos

1. Crea una base de datos PostgreSQL en Render.
2. Copia la **Internal Database URL**.

### 2. Web Service

1. Conecta tu repositorio de GitHub a un nuevo **Web Service** en Render.
2. Comandos de configuración:
    - **Build Command**: `npm install && npm run build`
    - **Start Command**: `npm start`

### 3. Variables de Entorno en Render

Añade estas variables en el panel de Render:

- `DATABASE_URL`: (La de Render)
- `JWT_SECRET`: (Tu clave secreta)
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `FIREBASE_SERVICE_ACCOUNT`: (Contenido completo de tu JSON de Firebase)

---

## 🔔 Notificaciones (Firebase)

1. Descarga el JSON de Service Account desde Firebase Console.
2. Para local: Guárdalo como `firebase-service-account.json` en la carpeta `API`.
3. Para Render: Usa la variable de entorno mencionada arriba.

---
**IMPORTANTE**: El archivo `.gitignore` ya está configurado para que no subas tus contraseñas por
error. No borres las entradas `.env` ni `*.json` del gitignore.
