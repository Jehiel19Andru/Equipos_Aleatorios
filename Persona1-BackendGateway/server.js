// Ejemplo básico de Gateway gRPC
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, './proto/sala.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
	keepCase: true,
	longs: String,
	enums: String,
	defaults: true,
	oneofs: true
});
const proto = grpc.loadPackageDefinition(packageDefinition);
const salaProto = proto.sala;

// Ejemplo: Gateway que reenvía llamadas a los microservicios
const docenteClient = new salaProto.SalaService(
	'localhost:50051',
	grpc.credentials.createInsecure()
);
const alumnoClient = new salaProto.SalaService(
	'localhost:50052',
	grpc.credentials.createInsecure()
);

function main() {
	const server = new grpc.Server();

	// Aquí puedes decidir a qué microservicio enviar cada llamada
	server.addService(salaProto.SalaService.service, {
		registrarDocente: (call, callback) => {
			docenteClient.registrarDocente(call.request, callback);
		},
		configurarIntegrantes: (call, callback) => {
			docenteClient.configurarIntegrantes(call.request, callback);
		},
		unirseAlumno: (call, callback) => {
			alumnoClient.unirseAlumno(call.request, callback);
		},
		obtenerEstado: (call, callback) => {
			docenteClient.obtenerEstado(call.request, callback);
		}
	});

	const PORT = 50053;
	server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
		if (err) {
			console.error('Error al iniciar Gateway:', err);
			return;
		}
		console.log(`Gateway gRPC corriendo en puerto ${port}`);
		server.start();
	});
}

main();