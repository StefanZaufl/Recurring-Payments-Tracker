FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# Copy OpenAPI spec (referenced by pom.xml as ../api/openapi.yaml)
COPY api/openapi.yaml /app/api/openapi.yaml

# Copy backend sources
COPY backend/pom.xml /app/backend/pom.xml
WORKDIR /app/backend
RUN mvn dependency:go-offline -B

COPY backend/src ./src
RUN mvn package -DskipTests -B

FROM eclipse-temurin:21-jre
WORKDIR /app

COPY --from=build /app/backend/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
