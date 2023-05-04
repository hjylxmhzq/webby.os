FROM --platform=linux/amd64 ubuntu:20.04

RUN apt update

RUN apt install -y libssl-dev

RUN mkdir /app

ADD dist /app

WORKDIR /app

EXPOSE 7001

VOLUME [ "/app" ]

ENTRYPOINT [ "/app/webbyos" ]

