using System;
using UnityEngine;

namespace WalkerNewDawn.World
{
    public class CityChunk : MonoBehaviour
    {
        private CityWorldGenerator world;
        private Vector2Int coordinate;
        private System.Random random;

        private Transform groundRoot;
        private Transform buildingRoot;
        private Transform propRoot;

        public void Build(
            CityWorldGenerator generator,
            Vector2Int chunkCoordinate,
            int chunkSeed)
        {
            world = generator;
            coordinate = chunkCoordinate;
            random = new System.Random(chunkSeed);

            CreateRoots();
            GenerateRoads();
            GenerateSidewalks();
            GenerateLot();
        }

        private void CreateRoots()
        {
            groundRoot = new GameObject("Ground").transform;
            groundRoot.SetParent(transform, false);

            buildingRoot = new GameObject("Buildings").transform;
            buildingRoot.SetParent(transform, false);

            propRoot = new GameObject("Props").transform;
            propRoot.SetParent(transform, false);
        }

        private void GenerateRoads()
        {
            float size = world.chunkSize;
            float road = world.roadWidth;

            Color asphalt =
                new Color(0.105f, 0.11f, 0.12f);

            // Horizontal street.
            CreateRectangle(
                "Street_Horizontal",
                new Vector2(size * 0.5f, 0),
                new Vector2(size, road),
                asphalt,
                -20,
                groundRoot
            );

            // Vertical street.
            CreateRectangle(
                "Street_Vertical",
                new Vector2(0, size * 0.5f),
                new Vector2(road, size),
                asphalt,
                -20,
                groundRoot
            );

            GenerateLaneMarkings();
            GenerateCrosswalks();
        }

        private void GenerateLaneMarkings()
        {
            float size = world.chunkSize;

            Color roadPaint =
                new Color(0.72f, 0.66f, 0.42f, 0.75f);

            // Horizontal dashed center line.
            for (float x = 8f; x < size; x += 9f)
            {
                CreateRectangle(
                    "RoadDash",
                    new Vector2(x, 0),
                    new Vector2(4f, 0.18f),
                    roadPaint,
                    -18,
                    groundRoot
                );
            }

            // Vertical dashed center line.
            for (float y = 8f; y < size; y += 9f)
            {
                CreateRectangle(
                    "RoadDash",
                    new Vector2(0, y),
                    new Vector2(0.18f, 4f),
                    roadPaint,
                    -18,
                    groundRoot
                );
            }
        }

        private void GenerateCrosswalks()
        {
            Color paint =
                new Color(0.8f, 0.8f, 0.76f, 0.7f);

            float start = world.roadWidth * 0.75f;

            for (int i = 0; i < 5; i++)
            {
                float offset = start + i * 0.8f;

                CreateRectangle(
                    "Crosswalk",
                    new Vector2(offset, 2.5f),
                    new Vector2(0.45f, 3f),
                    paint,
                    -17,
                    groundRoot
                );

                CreateRectangle(
                    "Crosswalk",
                    new Vector2(2.5f, offset),
                    new Vector2(3f, 0.45f),
                    paint,
                    -17,
                    groundRoot
                );
            }
        }

        private void GenerateSidewalks()
        {
            float size = world.chunkSize;
            float roadHalf = world.roadWidth * 0.5f;
            float sidewalk = world.sidewalkWidth;

            float innerSpan =
                size - world.roadWidth;

            Color concrete =
                new Color(0.40f, 0.40f, 0.38f);

            CreateRectangle(
                "Sidewalk_Left",
                new Vector2(
                    roadHalf + sidewalk * 0.5f,
                    size * 0.5f
                ),
                new Vector2(
                    sidewalk,
                    innerSpan
                ),
                concrete,
                -10,
                groundRoot
            );

            CreateRectangle(
                "Sidewalk_Right",
                new Vector2(
                    size - roadHalf - sidewalk * 0.5f,
                    size * 0.5f
                ),
                new Vector2(
                    sidewalk,
                    innerSpan
                ),
                concrete,
                -10,
                groundRoot
            );

            CreateRectangle(
                "Sidewalk_Bottom",
                new Vector2(
                    size * 0.5f,
                    roadHalf + sidewalk * 0.5f
                ),
                new Vector2(
                    innerSpan,
                    sidewalk
                ),
                concrete,
                -10,
                groundRoot
            );

            CreateRectangle(
                "Sidewalk_Top",
                new Vector2(
                    size * 0.5f,
                    size - roadHalf - sidewalk * 0.5f
                ),
                new Vector2(
                    innerSpan,
                    sidewalk
                ),
                concrete,
                -10,
                groundRoot
            );
        }

        private void GenerateLot()
        {
            float roll = RandomFloat();

            if (roll < world.parkChance)
            {
                GeneratePark();
                return;
            }

            roll -= world.parkChance;

            if (roll < world.parkingLotChance)
            {
                GenerateParkingLot();
                return;
            }

            roll -= world.parkingLotChance;

            if (roll < world.plazaChance)
            {
                GeneratePlaza();
                return;
            }

            GenerateBuildings();
        }

        private void GenerateBuildings()
        {
            GetLotBounds(
                out float min,
                out float max
            );

            float lotSize = max - min;

            float density =
                world.GetDistrictDensity(coordinate);

            int columns;

            int rows;

            if (density > 0.68f)
            {
                columns = random.Next(2, 4);
                rows = random.Next(2, 4);
            }
            else if (density > 0.42f)
            {
                columns = random.Next(2, 4);
                rows = random.Next(1, 3);
            }
            else
            {
                columns = random.Next(1, 3);
                rows = random.Next(1, 3);
            }

            float cellWidth = lotSize / columns;
            float cellHeight = lotSize / rows;

            for (int x = 0; x < columns; x++)
            {
                for (int y = 0; y < rows; y++)
                {
                    // Creates occasional alley/service gaps.
                    if (RandomFloat() < 0.10f)
                        continue;

                    float gap =
                        RandomRange(1.2f, 2.8f);

                    float width =
                        Mathf.Max(
                            4f,
                            cellWidth - gap * 2f
                        );

                    float height =
                        Mathf.Max(
                            4f,
                            cellHeight - gap * 2f
                        );

                    float centerX =
                        min +
                        x * cellWidth +
                        cellWidth * 0.5f;

                    float centerY =
                        min +
                        y * cellHeight +
                        cellHeight * 0.5f;

                    Vector2 position =
                        new Vector2(
                            centerX,
                            centerY
                        );

                    CreateBuilding(
                        position,
                        new Vector2(width, height),
                        density
                    );
                }
            }
        }

        private void CreateBuilding(
            Vector2 position,
            Vector2 dimensions,
            float density)
        {
            // Shadow.
            CreateRectangle(
                "Building_Shadow",
                position + new Vector2(-0.55f, -0.55f),
                dimensions,
                new Color(0.03f, 0.03f, 0.035f, 0.6f),
                -2,
                buildingRoot
            );

            Color buildingColor =
                GetBuildingColor();

            GameObject building =
                CreateRectangle(
                    "Building",
                    position,
                    dimensions,
                    buildingColor,
                    0,
                    buildingRoot
                );

            BoxCollider2D collider =
                building.AddComponent<BoxCollider2D>();

            collider.size = Vector2.one;

            // Roof border.
            CreateRectangle(
                "RoofInner",
                position,
                dimensions * 0.88f,
                buildingColor * 0.83f,
                1,
                buildingRoot
            );

            int roofObjects =
                density > 0.6f
                    ? random.Next(1, 4)
                    : random.Next(0, 3);

            for (int i = 0; i < roofObjects; i++)
            {
                float x =
                    position.x +
                    RandomRange(
                        -dimensions.x * 0.28f,
                        dimensions.x * 0.28f
                    );

                float y =
                    position.y +
                    RandomRange(
                        -dimensions.y * 0.28f,
                        dimensions.y * 0.28f
                    );

                CreateRectangle(
                    "RoofUtility",
                    new Vector2(x, y),
                    new Vector2(
                        RandomRange(0.8f, 2f),
                        RandomRange(0.8f, 2f)
                    ),
                    new Color(0.18f, 0.18f, 0.18f),
                    2,
                    buildingRoot
                );
            }

            // Simple entrance marker.
            CreateRectangle(
                "Entrance",
                new Vector2(
                    position.x,
                    position.y - dimensions.y * 0.5f
                ),
                new Vector2(
                    Mathf.Min(2f, dimensions.x * 0.25f),
                    0.35f
                ),
                new Color(0.10f, 0.07f, 0.04f),
                3,
                buildingRoot
            );
        }

        private void GeneratePark()
        {
            GetLotBounds(
                out float min,
                out float max
            );

            float lotSize = max - min;

            Vector2 center =
                Vector2.one * ((min + max) * 0.5f);

            CreateRectangle(
                "ParkGround",
                center,
                new Vector2(lotSize, lotSize),
                new Color(0.16f, 0.28f, 0.15f),
                -5,
                groundRoot
            );

            // Main walking paths.
            CreateRectangle(
                "ParkPath",
                center,
                new Vector2(2.2f, lotSize),
                new Color(0.48f, 0.43f, 0.34f),
                -3,
                groundRoot
            );

            CreateRectangle(
                "ParkPath",
                center,
                new Vector2(lotSize, 2.2f),
                new Color(0.48f, 0.43f, 0.34f),
                -3,
                groundRoot
            );

            int treeCount =
                random.Next(7, 15);

            for (int i = 0; i < treeCount; i++)
            {
                Vector2 position =
                    new Vector2(
                        RandomRange(min + 2f, max - 2f),
                        RandomRange(min + 2f, max - 2f)
                    );

                if (Mathf.Abs(position.x - center.x) < 2f ||
                    Mathf.Abs(position.y - center.y) < 2f)
                    continue;

                CreateTree(position);
            }
        }

        private void CreateTree(Vector2 position)
        {
            GameObject tree =
                new GameObject("Tree");

            tree.transform.SetParent(propRoot, false);
            tree.transform.localPosition = position;

            SpriteRenderer renderer =
                tree.AddComponent<SpriteRenderer>();

            renderer.sprite =
                ProceduralSpriteLibrary.Circle;

            renderer.color =
                new Color(
                    RandomRange(0.12f, 0.22f),
                    RandomRange(0.28f, 0.42f),
                    RandomRange(0.10f, 0.18f)
                );

            renderer.sortingOrder = 5;

            float size =
                RandomRange(1.8f, 3.2f);

            tree.transform.localScale =
                Vector3.one * size;

            CircleCollider2D collider =
                tree.AddComponent<CircleCollider2D>();

            collider.radius = 0.3f;
        }

        private void GenerateParkingLot()
        {
            GetLotBounds(
                out float min,
                out float max
            );

            float lotSize = max - min;

            Vector2 center =
                Vector2.one * ((min + max) * 0.5f);

            CreateRectangle(
                "ParkingLot",
                center,
                new Vector2(lotSize, lotSize),
                new Color(0.15f, 0.16f, 0.17f),
                -5,
                groundRoot
            );

            Color lineColor =
                new Color(0.72f, 0.72f, 0.63f);

            for (
                float x = min + 3f;
                x < max - 2f;
                x += 4f)
            {
                CreateRectangle(
                    "ParkingLine",
                    new Vector2(
                        x,
                        center.y
                    ),
                    new Vector2(
                        0.15f,
                        lotSize * 0.82f
                    ),
                    lineColor,
                    -3,
                    groundRoot
                );
            }

            // Some abandoned placeholder cars.
            int cars =
                random.Next(2, 8);

            for (int i = 0; i < cars; i++)
            {
                Vector2 position =
                    new Vector2(
                        RandomRange(min + 2f, max - 2f),
                        RandomRange(min + 2f, max - 2f)
                    );

                CreateRectangle(
                    "AbandonedCar",
                    position,
                    new Vector2(1.7f, 3f),
                    RandomCarColor(),
                    3,
                    propRoot,
                    true
                );
            }
        }

        private void GeneratePlaza()
        {
            GetLotBounds(
                out float min,
                out float max
            );

            float lotSize = max - min;

            Vector2 center =
                Vector2.one * ((min + max) * 0.5f);

            CreateRectangle(
                "Plaza",
                center,
                new Vector2(lotSize, lotSize),
                new Color(0.46f, 0.45f, 0.42f),
                -5,
                groundRoot
            );

            // Central planter.
            CreateRectangle(
                "Planter",
                center,
                new Vector2(7f, 7f),
                new Color(0.22f, 0.22f, 0.20f),
                0,
                propRoot,
                true
            );

            CreateTree(center);

            // Benches.
            CreateRectangle(
                "Bench",
                center + new Vector2(6f, 0),
                new Vector2(3f, 0.65f),
                new Color(0.27f, 0.16f, 0.08f),
                2,
                propRoot,
                true
            );

            CreateRectangle(
                "Bench",
                center + new Vector2(-6f, 0),
                new Vector2(3f, 0.65f),
                new Color(0.27f, 0.16f, 0.08f),
                2,
                propRoot,
                true
            );
        }

        private void GetLotBounds(
            out float min,
            out float max)
        {
            float roadHalf =
                world.roadWidth * 0.5f;

            min =
                roadHalf +
                world.sidewalkWidth +
                0.6f;

            max =
                world.chunkSize -
                roadHalf -
                world.sidewalkWidth -
                0.6f;
        }

        private Color GetBuildingColor()
        {
            Color[] palette =
            {
                new Color(0.31f, 0.26f, 0.23f),
                new Color(0.38f, 0.32f, 0.27f),
                new Color(0.30f, 0.31f, 0.31f),
                new Color(0.42f, 0.39f, 0.34f),
                new Color(0.26f, 0.27f, 0.29f),
                new Color(0.36f, 0.27f, 0.24f)
            };

            return palette[
                random.Next(0, palette.Length)
            ];
        }

        private Color RandomCarColor()
        {
            Color[] colors =
            {
                new Color(0.23f, 0.26f, 0.30f),
                new Color(0.37f, 0.12f, 0.10f),
                new Color(0.12f, 0.18f, 0.25f),
                new Color(0.38f, 0.38f, 0.35f),
                new Color(0.10f, 0.10f, 0.11f)
            };

            return colors[
                random.Next(0, colors.Length)
            ];
        }

        private GameObject CreateRectangle(
            string objectName,
            Vector2 localPosition,
            Vector2 size,
            Color color,
            int sortingOrder,
            Transform parent,
            bool collider = false)
        {
            GameObject obj =
                new GameObject(objectName);

            obj.transform.SetParent(parent, false);

            obj.transform.localPosition =
                new Vector3(
                    localPosition.x,
                    localPosition.y,
                    0
                );

            obj.transform.localScale =
                new Vector3(
                    size.x,
                    size.y,
                    1
                );

            SpriteRenderer renderer =
                obj.AddComponent<SpriteRenderer>();

            renderer.sprite =
                ProceduralSpriteLibrary.Square;

            renderer.color = color;
            renderer.sortingOrder = sortingOrder;

            if (collider)
                obj.AddComponent<BoxCollider2D>();

            return obj;
        }

        private float RandomFloat()
        {
            return (float)random.NextDouble();
        }

        private float RandomRange(
            float minimum,
            float maximum)
        {
            return minimum +
                   RandomFloat() *
                   (maximum - minimum);
        }
    }
}
