using System.Collections.Generic;
using UnityEngine;

namespace WalkerNewDawn.World
{
    public class CityWorldGenerator : MonoBehaviour
    {
        [Header("Player")]
        public Transform player;

        [Header("World Seed")]
        public int seed = 1987;

        [Header("Streaming")]
        [Min(1)]
        public int renderDistance = 2;

        [Header("City Layout")]
        public float chunkSize = 48f;
        public float roadWidth = 10f;
        public float sidewalkWidth = 3f;

        [Header("City Generation")]
        [Range(0f, 0.3f)]
        public float parkChance = 0.08f;

        [Range(0f, 0.3f)]
        public float parkingLotChance = 0.10f;

        [Range(0f, 0.3f)]
        public float plazaChance = 0.06f;

        private readonly Dictionary<Vector2Int, CityChunk> loadedChunks =
            new Dictionary<Vector2Int, CityChunk>();

        private Vector2Int currentPlayerChunk;
        private bool initialized;

        private void Start()
        {
            GenerateAroundPlayer();
        }

        private void Update()
        {
            if (player == null)
                return;

            Vector2Int newChunk = WorldToChunk(player.position);

            if (!initialized || newChunk != currentPlayerChunk)
                GenerateAroundPlayer();
        }

        private void GenerateAroundPlayer()
        {
            if (player == null)
                return;

            initialized = true;
            currentPlayerChunk = WorldToChunk(player.position);

            HashSet<Vector2Int> required =
                new HashSet<Vector2Int>();

            for (int x = -renderDistance; x <= renderDistance; x++)
            {
                for (int y = -renderDistance; y <= renderDistance; y++)
                {
                    Vector2Int coordinate =
                        currentPlayerChunk + new Vector2Int(x, y);

                    required.Add(coordinate);

                    if (!loadedChunks.ContainsKey(coordinate))
                        CreateChunk(coordinate);
                }
            }

            List<Vector2Int> remove =
                new List<Vector2Int>();

            foreach (var pair in loadedChunks)
            {
                if (!required.Contains(pair.Key))
                    remove.Add(pair.Key);
            }

            foreach (Vector2Int coordinate in remove)
            {
                CityChunk chunk = loadedChunks[coordinate];

                if (chunk != null)
                    Destroy(chunk.gameObject);

                loadedChunks.Remove(coordinate);
            }
        }

        private void CreateChunk(Vector2Int coordinate)
        {
            GameObject chunkObject =
                new GameObject(
                    $"CityChunk_{coordinate.x}_{coordinate.y}"
                );

            chunkObject.transform.SetParent(transform);

            chunkObject.transform.position =
                new Vector3(
                    coordinate.x * chunkSize,
                    coordinate.y * chunkSize,
                    0
                );

            CityChunk chunk =
                chunkObject.AddComponent<CityChunk>();

            chunk.Build(
                this,
                coordinate,
                GetChunkSeed(coordinate)
            );

            loadedChunks.Add(coordinate, chunk);
        }

        public Vector2Int WorldToChunk(Vector3 worldPosition)
        {
            return new Vector2Int(
                Mathf.FloorToInt(worldPosition.x / chunkSize),
                Mathf.FloorToInt(worldPosition.y / chunkSize)
            );
        }

        public int GetChunkSeed(Vector2Int coordinate)
        {
            unchecked
            {
                int hash = seed;

                hash = hash * 397 ^ coordinate.x;
                hash = hash * 397 ^ coordinate.y;

                return hash;
            }
        }

        public float GetDistrictDensity(Vector2Int coordinate)
        {
            float offset =
                Mathf.Abs(seed % 10000) * 0.001f;

            return Mathf.PerlinNoise(
                coordinate.x * 0.12f + offset,
                coordinate.y * 0.12f + offset
            );
        }
    }
}
