# Sistema de Equipos Aleatorios - Sistemas Distribuidos

Sistema distribuido para gestión de salas y asignación aleatoria de equipos de trabajo usando microservicios y gRPC.

---

## Instrucciones para cada persona del equipo

---

## Persona 1: Backend principal / Gateway

1. Abre una terminal en la carpeta `Persona1-BackendGateway`.
2. Ejecuta los siguientes comandos:
   ```sh
   npm install
   node server.js
   ```
3. El gateway escuchará en el puerto 50053 y reenviará las peticiones a los microservicios Docente (50051) y Alumno (50052).

---

## Persona 2: Microservicio de Docente

1. Abre una terminal en la carpeta `Persona2-DocenteService`.
2. Ejecuta los siguientes comandos:
   ```sh
   npm install
   node server.js
   ```
3. El microservicio escuchará en el puerto 50051.

---

## Persona 3: Microservicio de Alumno

1. Abre una terminal en la carpeta `Persona3-AlumnoService`.
2. Ejecuta los siguientes comandos:
   ```sh
   npm install
   node server.js
   ```
3. El microservicio escuchará en el puerto 50052.

---

## Persona 4: Frontend

1. Abre una terminal en la carpeta `Persona4-Frontend`.
2. Ejecuta los siguientes comandos:
   ```sh
   npm install
   node server.js
   ```
3. Abre en tu navegador:
   - http://localhost:3000/alumno.html
   - http://localhost:3000/docente.html

---

## Persona 5: Infraestructura, integración y documentación

- Apoya a los demás en la integración, pruebas, documentación y automatización.
- Puede crear archivos como `docker-compose.yml`, scripts de despliegue, documentación técnica, etc.

---

## Notas generales

- Todos deben estar en la misma red o configurar los puertos/IPs para que los servicios se comuniquen correctamente.
- Si algún servicio usa variables de entorno (.env), asegúrate de crearlas según sea necesario.
- El archivo `proto/sala.proto` debe ser igual en todos los servicios.

---

## Validaciones implementadas

- ✅ No se permite que un alumno use el mismo nombre que el docente
- ✅ No se permite nombres duplicados entre alumnos
- ✅ La comparación es insensible a mayúsculas y espacios en blanco
