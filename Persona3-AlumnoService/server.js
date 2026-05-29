const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, '../proto/sala.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
	keepCase: true,
	longs: String,
	enums: String,
	defaults: true,
	oneofs: true
});

const proto = grpc.loadPackageDefinition(packageDefinition);
const salaProto = proto.sala;

// Para este ejemplo, mantenemos el estado en el servicio docente
// El servicio alumno será un proxy
const docenteClient = new salaProto.SalaService(
	'localhost:50051',
	grpc.credentials.createInsecure()
);

function main() {
	const server = new grpc.Server();
  
	server.addService(salaProto.SalaService.service, {
		registrarDocente: async (call, callback) => {
			callback(null, { exito: false, mensaje: 'No implementado en alumno service', id_sala: '' });
		},
    
		configurarIntegrantes: async (call, callback) => {
			callback(null, { exito: false, mensaje: 'No implementado en alumno service' });
		},
    
		unirseAlumno: async (call, callback) => {
			docenteClient.unirseAlumno(call.request, (err, response) => {
				if (err) {
					callback(err, null);
				} else {
					callback(null, response);
				}
			});
		},
    
		obtenerEstado: async (call, callback) => {
			docenteClient.obtenerEstado(call.request, (err, response) => {
				if (err) {
					callback(err, null);
				} else {
					callback(null, response);
				}
			});
		}
	});
  
	const PORT = 50052;
	server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
		if (err) {
			console.error('Error al iniciar servidor gRPC:', err);
			return;
		}
		console.log(`Servicio Alumno gRPC corriendo en puerto ${port}`);
		server.start();
	});
}

main();