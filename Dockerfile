FROM node:20-alpine AS build-stage
WORKDIR /flash_card
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# NGINX
FROM nginx:stable-alpine AS nginx-stage
COPY --from=build-stage /flash_card/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]