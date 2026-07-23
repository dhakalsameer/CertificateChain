import "dotenv/config";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import http from "http";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const DB_PATH = join(__dirname, "..", "data.json");

function loadDb() {
  if (!existsSync(DB_PATH)) return [];
  try {
    return JSON.parse(readFileSync(DB_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function saveDb(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

const typeDefs = `#graphql
  type Certificate {
    id: ID!
    tokenId: String!
    studentName: String!
    regNo: String!
    course: String!
    grade: String!
    certificateHash: String!
    ipfsHash: String!
    studentAddress: String!
    nftMinted: Boolean!
    issuedAt: Float!
  }

  input CertificateInput {
    tokenId: String!
    studentName: String!
    regNo: String!
    course: String!
    grade: String!
    certificateHash: String!
    ipfsHash: String!
    studentAddress: String!
    nftMinted: Boolean!
    issuedAt: Float!
  }

  type Query {
    certificates: [Certificate!]!
    certificate(hash: String!): Certificate
    certificatesByStudent(address: String!): [Certificate!]!
  }

  type Mutation {
    addCertificate(input: CertificateInput!): Certificate!
    removeCertificate(hash: String!): Boolean!
  }
`;

const resolvers = {
  Query: {
    certificates: () => {
      const data = loadDb();
      return data.sort((a, b) => b.issuedAt - a.issuedAt);
    },
    certificate: (_, { hash }) => {
      const data = loadDb();
      return data.find((c) => c.certificateHash === hash) || null;
    },
    certificatesByStudent: (_, { address }) => {
      const data = loadDb();
      return data
        .filter((c) => c.studentAddress === address.toLowerCase())
        .sort((a, b) => b.issuedAt - a.issuedAt);
    },
  },
  Mutation: {
    addCertificate: (_, { input }) => {
      const data = loadDb();
      const existing = data.find((c) => c.certificateHash === input.certificateHash);
      if (existing) return existing;

      const cert = {
        id: String(Date.now()),
        tokenId: String(input.tokenId || "0"),
        studentName: input.studentName,
        regNo: input.regNo,
        course: input.course,
        grade: input.grade,
        certificateHash: input.certificateHash,
        ipfsHash: input.ipfsHash,
        studentAddress: (input.studentAddress || "").toLowerCase(),
        nftMinted: Boolean(input.nftMinted),
        issuedAt: input.issuedAt,
      };

      data.push(cert);
      saveDb(data);
      return cert;
    },
    removeCertificate: (_, { hash }) => {
      const data = loadDb();
      const idx = data.findIndex((c) => c.certificateHash === hash);
      if (idx === -1) return false;
      data.splice(idx, 1);
      saveDb(data);
      return true;
    },
  },
};

const app = express();
const httpServer = http.createServer(app);

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
});

await server.start();

app.use(cors());
app.use(express.json());
app.use("/graphql", expressMiddleware(server));

app.get("/health", (_, res) => {
  const data = loadDb();
  res.json({ status: "ok", certificates: data.length });
});

await new Promise((resolve) => httpServer.listen({ port: PORT }, resolve));
console.log(`GraphQL server ready at http://localhost:${PORT}/graphql`);
