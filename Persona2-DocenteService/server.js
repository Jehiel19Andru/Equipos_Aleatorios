const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const EventEmitter = require('events');

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

class SalaManager {
	constructor() {
		this.salas = new Map();
		this.historial = [];
		this.eventEmitter = new EventEmitter();
	}

	generarCodigoSala() {
		return Math.random().toString(36).substring(2, 8).toUpperCase();
	}

	crearSala(nombreDocente, codigoSala) {
		const codigo = (codigoSala || '').trim();
		const id_sala = codigo || this.generarCodigoSala();
		const sala = {
			id: id_sala,
			codigo: id_sala,
			docente: nombreDocente,
			integrantesPorEquipo: 2,
			alumnos: new Map(),
			equipos: new Map(),
			proximoEquipo: 1,
			activo: true
		};
		this.salas.set(id_sala, sala);
		return id_sala;
	}

	configurarIntegrantes(id_sala, cantidad) {
		const id = String(id_sala || '').trim();
		const sala = this.salas.get(id);
		if (!sala) return false;
    
		sala.integrantesPorEquipo = cantidad;
		this.reorganizarEquipos(sala);
		this.eventEmitter.emit('salaActualizada', id);
		return true;
	}

	asignarAEquipo(sala, alumno) {
		let equipoAsignado = -1;
    
		for (let [numEquipo, miembros] of sala.equipos.entries()) {
			if (miembros.length < sala.integrantesPorEquipo) {
				equipoAsignado = numEquipo;
				break;
			}
		}
    
		if (equipoAsignado === -1) {
			equipoAsignado = sala.proximoEquipo;
			sala.equipos.set(equipoAsignado, []);
			sala.proximoEquipo++;
		}
    
		sala.equipos.get(equipoAsignado).push(alumno);
		return equipoAsignado;
	}

	shuffleArray(array) {
		const copia = [...array];
		for (let i = copia.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[copia[i], copia[j]] = [copia[j], copia[i]];
		}
		return copia;
	}

	reorganizarEquipos(sala) {
		const todosAlumnos = Array.from(sala.alumnos.values());
		sala.equipos.clear();
		sala.proximoEquipo = 1;

		const totalAlumnos = todosAlumnos.length;
		if (totalAlumnos === 0) return;

		const baseSize = sala.integrantesPorEquipo;
		const fullTeams = Math.floor(totalAlumnos / baseSize);
		const remainder = totalAlumnos % baseSize;
		let teamSizes = [];

		if (fullTeams === 0) {
			teamSizes = [totalAlumnos];
		} else if (remainder === 0) {
			teamSizes = Array(fullTeams).fill(baseSize);
		} else if (remainder <= fullTeams) {
			teamSizes = Array(remainder).fill(baseSize + 1).concat(Array(fullTeams - remainder).fill(baseSize));
		} else {
			teamSizes = Array(fullTeams).fill(baseSize);
			teamSizes.push(remainder);
		}

		let index = 0;
		for (const size of teamSizes) {
			const equipoNumero = sala.proximoEquipo++;
			const miembros = todosAlumnos.slice(index, index + size);
			sala.equipos.set(equipoNumero, miembros);
			for (const alumno of miembros) {
				alumno.equipo = equipoNumero;
			}
			index += size;
		}
	}

	aleatorizarEquipos(id_sala) {
		const id = String(id_sala || '').trim();
		const sala = this.salas.get(id);
		if (!sala) return false;

		const alumnos = Array.from(sala.alumnos.values());
		if (alumnos.length === 0) return false;

		// Fisher-Yates shuffle
		const copia = [...alumnos];
		for (let i = copia.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[copia[i], copia[j]] = [copia[j], copia[i]];
		}

		sala.equipos.clear();
		sala.proximoEquipo = 1;

		const totalAlumnos = copia.length;
		const baseSize = sala.integrantesPorEquipo;
		const fullTeams = Math.floor(totalAlumnos / baseSize);
		const remainder = totalAlumnos % baseSize;
		let teamSizes = [];

		if (fullTeams === 0) {
			teamSizes = [totalAlumnos];
		} else if (remainder === 0) {
			teamSizes = Array(fullTeams).fill(baseSize);
		} else if (remainder <= fullTeams) {
			teamSizes = Array(remainder).fill(baseSize + 1).concat(Array(fullTeams - remainder).fill(baseSize));
		} else {
			teamSizes = Array(fullTeams).fill(baseSize);
			teamSizes.push(remainder);
		}

		teamSizes = this.shuffleArray(teamSizes);

		let index = 0;
		for (const size of teamSizes) {
			const equipoNumero = sala.proximoEquipo++;
			const miembros = copia.slice(index, index + size);
			sala.equipos.set(equipoNumero, miembros);
			for (const alumno of miembros) {
				alumno.equipo = equipoNumero;
			}
			index += size;
		}

		this.eventEmitter.emit('salaActualizada', id);
		return true;
	}

	unirseAlumno(id_sala, nombre, id_alumno) {
		const id = String(id_sala || '').trim();
		const sala = this.salas.get(id);
		if (!sala) return { exito: false, mensaje: 'Sala no encontrada', equipo: -1 };
		if (!sala.activo) return { exito: false, mensaje: 'Sala cerrada', equipo: -1 };
    
		const alumno = {
			id: id_alumno,
			nombre: nombre,
			equipo: -1
		};

		// Verificar nombres duplicados (normalizado: trim + minusculas)
		const nombreNorm = (nombre || '').trim().toLowerCase();
		const docenteNorm = (sala.docente || '').trim().toLowerCase();
		if (docenteNorm && docenteNorm === nombreNorm) {
			return { exito: false, mensaje: 'El nombre del alumno no puede coincidir con el docente. Elija otro nombre.', equipo: -1 };
		}
		for (const a of sala.alumnos.values()) {
			if (((a.nombre || '').trim().toLowerCase()) === nombreNorm) {
				return { exito: false, mensaje: 'Nombre de alumno duplicado. Añada un sufijo (por ejemplo: "1" o "#") para diferenciarlo', equipo: -1 };
			}
		}
    
		sala.alumnos.set(id_alumno, alumno);
		this.reorganizarEquipos(sala);
		const numeroEquipo = sala.alumnos.get(id_alumno).equipo;
    
		this.eventEmitter.emit('salaActualizada', id);
		return { exito: true, mensaje: 'Unido exitosamente', equipo: numeroEquipo };
	}

	desconectarAlumno(id_sala, id_alumno) {
		const id = String(id_sala || '').trim();
		const sala = this.salas.get(id);
		if (!sala) return { exito: false, mensaje: 'Sala no encontrada' };
		if (!sala.alumnos.has(id_alumno)) return { exito: false, mensaje: 'Alumno no encontrado en la sala' };
		sala.alumnos.delete(id_alumno);
		this.reorganizarEquipos(sala);
		this.eventEmitter.emit('salaActualizada', id);
		return { exito: true, mensaje: 'Alumno desconectado' };
	}

	obtenerEstadoSala(id_sala) {
		const id = String(id_sala || '').trim();
		const sala = this.salas.get(id);
		if (!sala) return null;
    
		const equiposLista = [];
		for (let [num, miembros] of sala.equipos.entries()) {
			equiposLista.push({
				numero: num,
				miembros: miembros.map(m => ({ id: m.id, nombre: m.nombre, equipo_numero: m.equipo })),
				completo: miembros.length === sala.integrantesPorEquipo
			});
		}
    
		return {
			alumnos: Array.from(sala.alumnos.values()).map(a => ({ id: a.id, nombre: a.nombre, equipo_numero: a.equipo })),
			equipos: equiposLista,
			integrantes_por_equipo: sala.integrantesPorEquipo,
			activo: sala.activo
		};
	}

	cambiarEstadoSala(id_sala, activo) {
		const id = String(id_sala || '').trim();
		const sala = this.salas.get(id);
		if (!sala) return false;
		// Si se cierra la sala, guardar snapshot en historial
		if (sala.activo && activo === false) {
			const snapshot = {
				id_sala: sala.id,
				codigo: sala.codigo,
				docente: sala.docente,
				equipos: Array.from(sala.equipos.entries()).map(([num, miembros]) => ({ numero: num, miembros: miembros.map(m => ({ id: m.id, nombre: m.nombre })) })),
				alumnos: Array.from(sala.alumnos.values()).map(a => ({ id: a.id, nombre: a.nombre, equipo: a.equipo })),
				integrantes_por_equipo: sala.integrantesPorEquipo,
				fechaCierre: Date.now()
			};
			this.historial.unshift(snapshot);
		}
		sala.activo = activo;
		this.eventEmitter.emit('salaActualizada', id);
		return true;
	}

	eliminarSala(id_sala) {
		const id = String(id_sala || '').trim();
		const sala = this.salas.get(id);
		if (!sala) return { exito: false, mensaje: 'Sala no encontrada' };
		// Guardar snapshot de eliminacion
		const snapshot = {
			id_sala: sala.id,
			codigo: sala.codigo,
			docente: sala.docente,
			equipos: Array.from(sala.equipos.entries()).map(([num, miembros]) => ({ numero: num, miembros: miembros.map(m => ({ id: m.id, nombre: m.nombre })) })),
			alumnos: Array.from(sala.alumnos.values()).map(a => ({ id: a.id, nombre: a.nombre, equipo: a.equipo })),
			integrantes_por_equipo: sala.integrantesPorEquipo,
			fechaEliminacion: Date.now()
		};
		this.historial.unshift(snapshot);
		this.salas.delete(id);
		this.eventEmitter.emit('salaActualizada', id);
		return { exito: true, mensaje: 'Sala eliminada' };
	}

	// Obtener historial (snapshot) de salas cerradas
	obtenerHistorial() {
		return this.historial.slice();
	}
}

const salaManager = new SalaManager();

function main() {
	const server = new grpc.Server();
  
	server.addService(salaProto.SalaService.service, {
		registrarDocente: async (call, callback) => {
			const { nombre, codigo_sala } = call.request;
			const id_sala = salaManager.crearSala(nombre, codigo_sala);
			callback(null, { exito: true, mensaje: 'Sala creada exitosamente', id_sala: id_sala });
		},
    
		configurarIntegrantes: async (call, callback) => {
			const { id_sala, integrantes_por_equipo } = call.request;
			const exito = salaManager.configurarIntegrantes(id_sala, integrantes_por_equipo);
			callback(null, { 
				exito: exito, 
				mensaje: exito ? 'Configuracion actualizada' : 'Error al configurar' 
			});
		},
    
		unirseAlumno: async (call, callback) => {
			const { nombre, codigo_sala } = call.request;
			const id_alumno = Math.random().toString(36).substring(2, 10);
			const resultado = salaManager.unirseAlumno(codigo_sala, nombre, id_alumno);
			callback(null, {
				exito: resultado.exito,
				mensaje: resultado.mensaje,
				numero_equipo: resultado.equipo,
				id_alumno: id_alumno
			});
		},
    
		obtenerEstado: async (call, callback) => {
			const { id_sala } = call.request;
			const estado = salaManager.obtenerEstadoSala(id_sala);
			if (estado) {
				callback(null, estado);
			} else {
				callback(null, { alumnos: [], equipos: [], integrantes_por_equipo: 2 });
			}
		},

		aleatorizarEquipos: async (call, callback) => {
			const { id_sala } = call.request;
			const exito = salaManager.aleatorizarEquipos(id_sala);
			callback(null, {
				exito: exito,
				mensaje: exito ? 'Equipos aleatorizados exitosamente' : 'Error al aleatorizar'
			});
		},

		desconectarAlumno: async (call, callback) => {
			const { id_sala, id_alumno } = call.request;
			const resultado = salaManager.desconectarAlumno(id_sala, id_alumno);
			callback(null, { exito: resultado.exito, mensaje: resultado.mensaje });
		},

		cambiarEstadoSala: async (call, callback) => {
			const { id_sala, activo } = call.request;
			const exito = salaManager.cambiarEstadoSala(id_sala, activo);
			callback(null, {
				exito: exito,
				mensaje: exito ? 'Estado actualizado' : 'Error al cambiar estado'
			});
		}
		,

		eliminarSala: async (call, callback) => {
			const { id_sala } = call.request;
			const resultado = salaManager.eliminarSala(id_sala);
			callback(null, { exito: resultado.exito, mensaje: resultado.mensaje, id_sala: id_sala });
		}
	});
  
	const PORT = 50051;
	server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
		if (err) {
			console.error('Error al iniciar servidor gRPC:', err);
			return;
		}
		console.log(`Servicio Docente gRPC corriendo en puerto ${port}`);
		server.start();
	});
}

main();

module.exports = { salaManager };