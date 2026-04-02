FROM nginx:1.27-alpine

COPY deploy/docker/nginx-default.conf /etc/nginx/conf.d/default.conf
COPY mapwisp /usr/share/nginx/html/mapwisp

EXPOSE 80
