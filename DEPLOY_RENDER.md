# 🚀 Guía de Despliegue en Render

## Estructura de repositorios

Este proyecto usa **dos repositorios Git independientes**:

| Repositorio | Contenido | URL |
|---|---|---|
| **MeetFlow** | Monorepo completo (Android, iOS, shared, API, etc.) | https://github.com/jcpg1982/MeetFlow.git |
| **MeetFlowApi** | Solo el contenido de esta carpeta `API/` (lo que Render despliega) | https://github.com/jcpg1982/MeetFlowApi.git |

> ⚠️ **Importante:** Render apunta a `MeetFlowApi`. El `package.json` debe estar en la raíz de ese repositorio, por eso se publica solo la subcarpeta `API/` y no el monorepo completo.

---

## Remotos Git configurados localmente

Desde la raíz del monorepo (`MeetFlow/`), los remotos están configurados así:

```bash
# Ver remotos actuales (ejecutar desde la carpeta API/)
git remote -v

# Resultado esperado:
# api-repo   https://github.com/jcpg1982/MeetFlowApi.git (fetch)
# api-repo   https://github.com/jcpg1982/MeetFlowApi.git (push)
# origin     https://github.com/jcpg1982/MeetFlow.git (fetch)
# origin     https://github.com/jcpg1982/MeetFlow.git (push)
```

---

## 🔄 Flujo de trabajo para publicar cambios en la API

Ejecutar **desde la raíz del monorepo** (`D:\Trabajos\Personal\Android\MeetFlow\`):

### Paso 1 — Commit y push al monorepo general

```bash
git add API/
git commit -m "feat(api): descripción del cambio"
git push origin develop
```

### Paso 2 — Sincronizar MeetFlowApi (lo que despliega Render)

```bash
git subtree push --prefix=API api-repo main
```

> Este comando extrae automáticamente solo los archivos dentro de `API/` y los publica en `MeetFlowApi` como si fueran la raíz del repositorio. Es incremental, no requiere force push en condiciones normales.

---

## ⚙️ Configuración del servicio en Render

| Campo | Valor |
|---|---|
| **Repositorio** | `https://github.com/jcpg1982/MeetFlowApi.git` |
| **Rama** | `main` |
| **Comando de build** | `npm install --legacy-peer-deps --include=dev && npm run build && npx prisma db push` |
| **Comando de inicio** | `npm start` |
| **Node.js version** | 24+ |

---

## 🆘 Solución de problemas comunes

### Error: `Cannot find package.json`
Significa que se publicó el monorepo completo en lugar de solo la carpeta `API/`.  
**Solución:** Volver a ejecutar el Paso 2 con `git subtree push`.

### Error: `non-fast-forward` al hacer subtree push
Significa que el remoto tiene cambios no integrados.  
**Solución:** No hacer rebase — contactar al equipo para verificar si alguien hizo cambios directos en `MeetFlowApi`.
