const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PROTO_PATH = path.join(__dirname, 'proto/sala.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
	keepCase: true,
	longs: String,
	enums: String,
	defaults: true,
	oneofs: true
});

const proto = grpc.loadPackageDefinition(packageDefinition);
const salaProto = proto.sala;

const docenteClient = new salaProto.SalaService(
	'192.168.50.71:50051',
	grpc.credentials.createInsecure()
);

const salasWebSocket = new Map();

function broadcastActualizacionSala(id_sala) {
	docenteClient.obtenerEstado({ id_sala: id_sala }, (err, response) => {
		if (!err && response && salasWebSocket.has(id_sala)) {
			const clients = salasWebSocket.get(id_sala);
			const data = JSON.stringify({
				type: 'actualizacion',
				data: {
					alumnos: response.alumnos,
					equipos: response.equipos,
					integrantes_por_equipo: response.integrantes_por_equipo,
					activo: response.activo
				}
			});
			clients.forEach(client => {
				if (client.readyState === WebSocket.OPEN) {
					client.send(data);
				}
			});
		}
	});
}

setInterval(() => {
	salasWebSocket.forEach((clients, id_sala) => {
		broadcastActualizacionSala(id_sala);
	});
}, 1000);

wss.on('connection', (ws, req) => {
	console.log('Cliente WebSocket conectado');
  
	ws.on('message', async (message) => {
		const data = JSON.parse(message);
    
		if (data.type === 'registrar_docente') {
			docenteClient.registrarDocente({
				nombre: data.nombre,
				codigo_sala: data.codigo_sala
			}, (err, response) => {
				if (!err && response.exito) {
					if (!salasWebSocket.has(response.id_sala)) {
						salasWebSocket.set(response.id_sala, new Set());
					}
					salasWebSocket.get(response.id_sala).add(ws);
					ws.salaId = response.id_sala;
					ws.tipo = 'docente';
          
					ws.send(JSON.stringify({
						type: 'registro_exitoso',
						data: { id_sala: response.id_sala, mensaje: response.mensaje }
					}));
				} else {
					ws.send(JSON.stringify({
						type: 'error',
						data: { mensaje: err ? err.message : 'Error al registrar docente' }
					}));
				}
			});
		}
    
		if (data.type === 'configurar_equipos') {
			docenteClient.configurarIntegrantes({
				id_sala: data.id_sala,
				integrantes_por_equipo: data.integrantes
			}, (err, response) => {
				ws.send(JSON.stringify({
					type: 'configuracion_completada',
					data: { exito: response.exito, mensaje: response.mensaje }
				}));
				if (response.exito) {
					broadcastActualizacionSala(data.id_sala);
				}
			});
		}
    
		if (data.type === 'balancear_equipos') {
			docenteClient.obtenerEstado({ id_sala: data.id_sala }, (err, response) => {
				if (err || !response) {
					ws.send(JSON.stringify({
						type: 'balanceo_completado',
						data: { exito: false, mensaje: err ? err.message : 'No se pudo obtener estado de la sala' }
					}));
					return;
				}
				docenteClient.configurarIntegrantes({
					id_sala: data.id_sala,
					integrantes_por_equipo: response.integrantes_por_equipo
				}, (err2, response2) => {
					const exito = !!response2 && response2.exito;
					const mensaje = err2 ? err2.message : (response2 ? response2.mensaje : 'Error desconocido');
					ws.send(JSON.stringify({
						type: 'balanceo_completado',
						data: { exito: exito, mensaje: mensaje }
					}));
					if (exito) {
						broadcastActualizacionSala(data.id_sala);
					}
				});
			});
		}
    
		if (data.type === 'unirse_alumno') {
			docenteClient.unirseAlumno({
				nombre: data.nombre,
				codigo_sala: data.codigo_sala
			}, (err, response) => {
				if (!err && response && response.exito) {
					if (!salasWebSocket.has(data.codigo_sala)) {
						salasWebSocket.set(data.codigo_sala, new Set());
					}
					salasWebSocket.get(data.codigo_sala).add(ws);
					ws.salaId = data.codigo_sala;
					ws.tipo = 'alumno';
					ws.alumnoId = response.id_alumno;
          
					ws.send(JSON.stringify({
						type: 'union_exitosa',
						data: { 
							numero_equipo: response.numero_equipo,
							id_alumno: response.id_alumno,
							mensaje: response.mensaje 
						}
					}));
					broadcastActualizacionSala(data.codigo_sala);
				} else {
					const mensaje = (response && response.mensaje) ? response.mensaje : (err ? err.message : 'Error al unirse');
					ws.send(JSON.stringify({
						type: 'error',
						data: { mensaje: mensaje }
					}));
				}
			});
		}
    
		if (data.type === 'obtener_estado') {
			docenteClient.obtenerEstado({ id_sala: data.id_sala }, (err, response) => {
				if (!err) {
					ws.send(JSON.stringify({
						type: 'estado_actual',
						data: response
					}));
				}
			});
		}

		if (data.type === 'logout_alumno') {
			docenteClient.desconectarAlumno({ id_sala: data.codigo_sala, id_alumno: data.id_alumno }, (err, response) => {
				const mensaje = (response && response.mensaje) ? response.mensaje : (err ? err.message : 'Error al cerrar sesion');
				if (!err && response && response.exito) {
					ws.send(JSON.stringify({ type: 'logout_exitoso', data: { mensaje: mensaje } }));
					broadcastActualizacionSala(data.codigo_sala);
				} else {
					ws.send(JSON.stringify({ type: 'error', data: { mensaje: mensaje } }));
				}
			});
		}

		if (data.type === 'aleatorizar_equipos') {
			docenteClient.aleatorizarEquipos({ id_sala: data.id_sala }, (err, response) => {
				if (response && response.exito) {
					ws.send(JSON.stringify({
						type: 'aleatorizar_completado',
						data: { exito: true, mensaje: 'Aleatorización exitosa' }
					}));
				broadcastActualizacionSala(data.id_sala);
				} else {
					ws.send(JSON.stringify({
						type: 'aleatorizar_completado',
						data: { exito: false, mensaje: err ? err.message : 'Error al aleatorizar' }
					}));
				}
			});
		}

		if (data.type === 'cambiar_estado_sala') {
			docenteClient.cambiarEstadoSala({ 
				id_sala: data.id_sala,
				activo: data.activo
			}, (err, response) => {
				if (response && response.exito) {
					ws.send(JSON.stringify({
						type: 'cambio_estado_completado',
						data: { exito: true, activo: data.activo }
					}));
					broadcastActualizacionSala(data.id_sala);
				} else {
					ws.send(JSON.stringify({
						type: 'cambio_estado_completado',
						data: { exito: false, mensaje: 'Error al cambiar estado' }
					}));
				}
			});
		}

		if (data.type === 'eliminar_sala') {
			docenteClient.eliminarSala({ id_sala: data.id_sala }, (err, response) => {
				const mensaje = (response && response.mensaje) ? response.mensaje : (err ? err.message : 'Error al eliminar sala');
				if (response && response.exito) {
					// Notificar a todos los websockets de la sala y eliminar la entrada
					if (salasWebSocket.has(data.id_sala)) {
						const clients = salasWebSocket.get(data.id_sala);
						clients.forEach(client => {
							if (client.readyState === WebSocket.OPEN) {
								client.send(JSON.stringify({ type: 'sala_eliminada', data: { id_sala: data.id_sala, mensaje: mensaje } }));
							}
						});
						salasWebSocket.delete(data.id_sala);
					}
					ws.send(JSON.stringify({ type: 'eliminar_completado', data: { exito: true, id_sala: data.id_sala, mensaje: mensaje } }));
				} else {
					ws.send(JSON.stringify({ type: 'eliminar_completado', data: { exito: false, id_sala: data.id_sala, mensaje: mensaje } }));
				}
			});
		}
	});

	ws.on('close', () => {
		if (ws.tipo === 'alumno' && ws.salaId && ws.alumnoId) {
			docenteClient.desconectarAlumno({ id_sala: ws.salaId, id_alumno: ws.alumnoId }, () => {
				broadcastActualizacionSala(ws.salaId);
			});
		}
		if (ws.salaId && salasWebSocket.has(ws.salaId)) {
			salasWebSocket.get(ws.salaId).delete(ws);
			if (salasWebSocket.get(ws.salaId).size === 0) {
				salasWebSocket.delete(ws.salaId);
			}
		}
	});
});

app.use(express.static(path.join(__dirname, 'public')));

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
	console.log(`Frontend servidor corriendo en http://0.0.0.0:${PORT}`);
	console.log(`Interfaz Docente: http://0.0.0.0:${PORT}/docente.html`);
	console.log(`Interfaz Alumno: http://0.0.0.0:${PORT}/alumno.html`);
});