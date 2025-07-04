# DKG API Server

This server provides HTTP API endpoints to publish and query Knowledge Assets on the OriginTrail Decentralized Knowledge Graph (DKG).

## Prerequisites
- Node.js v16 or newer
- npm
- An OriginTrail-compatible private key in your environment (see below)

## Setup

1. **Install dependencies:**
   ```sh
   npm install
   ```

2. **Set your private key:**
   Create a `.env` file in the `server` directory with the following content:
   ```env
   PRIVATE_KEY=your_private_key_here
   ```

## Running the Server

From the `server` directory (or project root), run:
```sh
node api.mjs
```
You should see:
```
API server listening on port 3000
```

## API Endpoints

Tip: You can customize the name and description fields with your own content! Make sure to also change the last part of the @id (e.g., from "hello-dkg" to "my-asset-name") to keep your asset unique for querying later!

### 1. Publish Knowledge Asset
- **Endpoint:** `POST /publish`
- **Description:** Publishes a knowledge asset to the DKG.
- **Request Body:** JSON object representing the asset (see example below).
- **Sample curl:**
  ```sh
  curl -X POST http://localhost:3000/publish \
    -H "Content-Type: application/json" \
    -d '{
      "public": {
        "@context": "https://www.schema.org",
        "@id": "urn:first-dkg-ka:info:hello-dkg",
        "@type": "CreativeWork",
        "name": "Hello DKG",
        "description": "My first Knowledge Asset on the Decentralized Knowledge Graph!"
      }
    }'
  ```

### 2. Query Knowledge Asset
- **Endpoint:** `POST /query`
- **Description:** Runs a SPARQL query against the DKG.
- **Request Body:**
  - `query`: SPARQL query string (required)
  - `queryType`: Query type (optional, default: `SELECT`)
- **Sample curl:**
  ```sh
  curl -X POST http://localhost:3000/query \
    -H "Content-Type: application/json" \
    -d '{
      "query": "PREFIX schema: <http://schema.org/>\\nSELECT ?s ?name ?description\\nWHERE {\\n  ?s schema:name ?name ;\\n     schema:description ?description .\\n  FILTER(LCASE(?name) = \\\"hello dkg\\\")\\n}",
      "queryType": "SELECT"
    }'
  ```

### 3. Get All Published Assets
- **Endpoint:** `GET /published-assets`
- **Description:** Returns all assets ever published via the API, as stored in the local `published_assets.json` file. Each entry includes the original content, DKG result, and timestamp.
- **Sample curl:**
  ```sh
  curl http://localhost:3000/published-assets
  ```

## Notes
- Make sure your private key has sufficient permissions and funds for publishing assets on the selected network.
- You can change the port by setting the `PORT` environment variable. 