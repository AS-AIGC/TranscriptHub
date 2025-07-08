APP?=app
ImageName?=justgps/aisuite
version?=0.2.4
ContainerName?=openaisuite
PORT?=80
MKFILE := $(abspath $(lastword $(MAKEFILE_LIST)))
CURDIR := $(dir $(MKFILE))
GoMode?=on

clean:
	go clean

tidy:
	go mod tidy

build: tidy clean
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 GO111MODULE=${GoMode} go build -tags netgo \
	-o ${APP}

build-win: tidy clean
	go build -tags netgo -o ${APP}.exe

docker: build
	docker build -t ${ImageName}:${version} .
	rm -f ${APP}
	docker images

log:
	docker logs -f -t --tail 20 ${ContainerName}

run: docker
	docker run -d --restart=always --name ${ContainerName} \
	-v ${CURDIR}www:/app/www  \
	-v ${CURDIR}envfile:/app/envfile  \
	-v ${CURDIR}tmp:/app/tmp  \
	-p ${PORT}:80 \
	--env-file ${CURDIR}envfile \
	${ImageName}:${version}

run-same-host: docker
	docker run -d --restart=always --name ${ContainerName} \
	--add-host host.docker.internal:host-gateway \
	-v ${CURDIR}www:/app/www  \
	-v ${CURDIR}envfile:/app/envfile  \
	-v ${CURDIR}tmp:/app/tmp  \
	-p ${PORT}:80 \
	--env-file ${CURDIR}envfile \
	${ImageName}:${version}

stop:
	docker stop ${ContainerName}
	docker rm ${ContainerName}

re: stop run