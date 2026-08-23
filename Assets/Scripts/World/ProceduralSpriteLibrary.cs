using UnityEngine;

namespace WalkerNewDawn.World
{
    public static class ProceduralSpriteLibrary
    {
        private static Sprite squareSprite;
        private static Sprite circleSprite;
        private static Sprite playerSprite;

        public static Sprite Square
        {
            get
            {
                if (squareSprite == null)
                    squareSprite = CreateSquare();

                return squareSprite;
            }
        }

        public static Sprite Circle
        {
            get
            {
                if (circleSprite == null)
                    circleSprite = CreateCircle();

                return circleSprite;
            }
        }

        public static Sprite Player
        {
            get
            {
                if (playerSprite == null)
                    playerSprite = CreatePlayer();

                return playerSprite;
            }
        }

        private static Sprite CreateSquare()
        {
            Texture2D texture = new Texture2D(1, 1);
            texture.name = "RuntimeSquare";
            texture.filterMode = FilterMode.Point;
            texture.wrapMode = TextureWrapMode.Clamp;

            texture.SetPixel(0, 0, Color.white);
            texture.Apply();

            return Sprite.Create(
                texture,
                new Rect(0, 0, 1, 1),
                new Vector2(0.5f, 0.5f),
                1f
            );
        }

        private static Sprite CreateCircle()
        {
            const int size = 16;

            Texture2D texture = new Texture2D(size, size);
            texture.name = "RuntimeCircle";
            texture.filterMode = FilterMode.Point;
            texture.wrapMode = TextureWrapMode.Clamp;

            Vector2 center = new Vector2(
                (size - 1) / 2f,
                (size - 1) / 2f
            );

            float radius = size * 0.45f;

            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float distance = Vector2.Distance(
                        new Vector2(x, y),
                        center
                    );

                    texture.SetPixel(
                        x,
                        y,
                        distance <= radius
                            ? Color.white
                            : Color.clear
                    );
                }
            }

            texture.Apply();

            return Sprite.Create(
                texture,
                new Rect(0, 0, size, size),
                new Vector2(0.5f, 0.5f),
                16f
            );
        }

        private static Sprite CreatePlayer()
        {
            const int width = 12;
            const int height = 16;

            Texture2D texture = new Texture2D(width, height);
            texture.name = "RuntimePlayer";
            texture.filterMode = FilterMode.Point;
            texture.wrapMode = TextureWrapMode.Clamp;

            Color transparent = Color.clear;

            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                    texture.SetPixel(x, y, transparent);
            }

            Color skin = new Color(0.68f, 0.48f, 0.34f);
            Color shirt = new Color(0.22f, 0.28f, 0.34f);
            Color pants = new Color(0.12f, 0.14f, 0.17f);
            Color shoes = new Color(0.05f, 0.05f, 0.05f);
            Color hair = new Color(0.08f, 0.06f, 0.05f);

            // Head.
            Fill(texture, 4, 11, 4, 4, skin);

            // Hair.
            Fill(texture, 4, 14, 4, 1, hair);

            // Torso.
            Fill(texture, 3, 6, 6, 5, shirt);

            // Arms.
            Fill(texture, 2, 6, 1, 4, skin);
            Fill(texture, 9, 6, 1, 4, skin);

            // Legs.
            Fill(texture, 4, 2, 2, 4, pants);
            Fill(texture, 7, 2, 2, 4, pants);

            // Shoes.
            Fill(texture, 3, 1, 3, 1, shoes);
            Fill(texture, 7, 1, 3, 1, shoes);

            texture.Apply();

            return Sprite.Create(
                texture,
                new Rect(0, 0, width, height),
                new Vector2(0.5f, 0.1f),
                12f
            );
        }

        private static void Fill(
            Texture2D texture,
            int startX,
            int startY,
            int width,
            int height,
            Color color)
        {
            for (int y = startY; y < startY + height; y++)
            {
                for (int x = startX; x < startX + width; x++)
                    texture.SetPixel(x, y, color);
            }
        }
    }
}
