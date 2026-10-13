# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Railway passes service variables as build args when declared here
ARG VITE_API_URL
ARG VITE_BASE_PATH
ENV VITE_API_URL=$VITE_API_URL VITE_BASE_PATH=$VITE_BASE_PATH
RUN npm run build

# ---- serve ----
FROM nginx:1.27-alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV PORT=8080
EXPOSE 8080
