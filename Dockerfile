# --- Etapa 1: Build ---
# Usa una imagen de Node con todas las herramientas de compilación
FROM node:lts-alpine AS build
WORKDIR /usr/src/app

# Copia package.json y package-lock.json
COPY package*.json ./

# Instala todas las dependencias (incluyendo devDependencies para compilar)
RUN npm install

# Copia el resto del código fuente de la aplicación
COPY . .

# Compila la aplicación para producción, generando la carpeta 'dist'
RUN npm run build

# --- Etapa 2: Production ---
# Usa una imagen de Node ligera para producción
FROM node:lts-alpine

ENV NODE_ENV=production
WORKDIR /usr/src/app

COPY --from=build /usr/src/app/package*.json ./
RUN npm install --production

COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/server.js .

# Set correct permissions for the non-root user and switch to it
RUN chown -R node:node .
USER node

EXPOSE 3001
CMD ["node", "server.js"]
