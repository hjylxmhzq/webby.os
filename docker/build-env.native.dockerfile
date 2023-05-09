FROM ubuntu:20.04

SHELL ["/bin/bash", "-c"] 

ARG DEBIAN_FRONTEND=noninteractive

RUN apt update -y
RUN apt install -y curl
RUN apt install -y git
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash
RUN apt-get install -y nodejs
RUN apt install -y pkg-config

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o rust-init.sh
RUN chmod 755 rust-init.sh
RUN ./rust-init.sh -y
ENV PATH="/root/.cargo/bin:${PATH}"
RUN rustup default stable
RUN apt install -y build-essential
RUN npm install -g yarn
RUN apt install -y libssl-dev
