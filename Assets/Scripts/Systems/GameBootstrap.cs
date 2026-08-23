using UnityEngine;
using WalkerNewDawn.Player;
using WalkerNewDawn.World;

namespace WalkerNewDawn.Systems
{
    public static class GameBootstrap
    {
        [RuntimeInitializeOnLoadMethod(
            RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            PlayerController existingPlayer =
                Object.FindObjectOfType<PlayerController>();

            CityWorldGenerator existingWorld =
                Object.FindObjectOfType<CityWorldGenerator>();

            PlayerController player =
                existingPlayer != null
                    ? existingPlayer
                    : CreatePlayer();

            SetupCamera(player.transform);

            CityWorldGenerator world =
                existingWorld != null
                    ? existingWorld
                    : CreateWorld();

            world.player = player.transform;

            SetupHUD(player);
        }

        private static PlayerController CreatePlayer()
        {
            GameObject playerObject =
                new GameObject("Player");

            playerObject.transform.position =
                Vector3.zero;

            SpriteRenderer renderer =
                playerObject.AddComponent<SpriteRenderer>();

            renderer.sprite =
                ProceduralSpriteLibrary.Player;

            renderer.sortingOrder = 50;

            playerObject.transform.localScale =
                Vector3.one * 1.4f;

            Rigidbody2D rigidbody =
                playerObject.AddComponent<Rigidbody2D>();

            rigidbody.gravityScale = 0;
            rigidbody.freezeRotation = true;
            rigidbody.interpolation =
                RigidbodyInterpolation2D.Interpolate;

            CapsuleCollider2D collider =
                playerObject.AddComponent<CapsuleCollider2D>();

            collider.size =
                new Vector2(0.45f, 0.65f);

            collider.offset =
                new Vector2(0, 0.28f);

            PlayerController controller =
                playerObject.AddComponent<PlayerController>();

            return controller;
        }

        private static void SetupCamera(
            Transform target)
        {
            Camera camera = Camera.main;

            if (camera == null)
            {
                GameObject cameraObject =
                    new GameObject("Main Camera");

                camera =
                    cameraObject.AddComponent<Camera>();

                cameraObject.tag = "MainCamera";
            }

            camera.orthographic = true;
            camera.orthographicSize = 10f;

            camera.backgroundColor =
                new Color(
                    0.045f,
                    0.05f,
                    0.055f
                );

            camera.transform.position =
                new Vector3(
                    target.position.x,
                    target.position.y,
                    -10
                );

            CameraFollow follow =
                camera.GetComponent<CameraFollow>();

            if (follow == null)
                follow =
                    camera.gameObject.AddComponent<CameraFollow>();

            follow.target = target;
        }

        private static CityWorldGenerator CreateWorld()
        {
            GameObject worldObject =
                new GameObject("Procedural NYC");

            return worldObject
                .AddComponent<CityWorldGenerator>();
        }

        private static void SetupHUD(
            PlayerController player)
        {
            PrototypeHUD hud =
                Object.FindObjectOfType<PrototypeHUD>();

            if (hud == null)
            {
                GameObject hudObject =
                    new GameObject("Prototype HUD");

                hud =
                    hudObject.AddComponent<PrototypeHUD>();
            }

            hud.player = player;
        }
    }
}
