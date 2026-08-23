using UnityEngine;
using WalkerNewDawn.Player;

namespace WalkerNewDawn.Systems
{
    public class PrototypeHUD : MonoBehaviour
    {
        public PlayerController player;

        private GUIStyle titleStyle;
        private GUIStyle textStyle;

        private void SetupStyles()
        {
            if (titleStyle != null)
                return;

            titleStyle = new GUIStyle(GUI.skin.label);
            titleStyle.fontSize = 19;
            titleStyle.fontStyle = FontStyle.Bold;
            titleStyle.normal.textColor = Color.white;

            textStyle = new GUIStyle(GUI.skin.label);
            textStyle.fontSize = 14;
            textStyle.normal.textColor =
                new Color(0.92f, 0.92f, 0.92f);
        }

        private void OnGUI()
        {
            SetupStyles();

            GUI.Box(
                new Rect(15, 15, 235, 105),
                ""
            );

            GUI.Label(
                new Rect(28, 24, 200, 25),
                "WALKER: NEW DAWN",
                titleStyle
            );

            GUI.Label(
                new Rect(28, 52, 190, 20),
                "NYC Prototype",
                textStyle
            );

            if (player == null)
                return;

            float stamina =
                player.GetStaminaPercent();

            GUI.Label(
                new Rect(28, 75, 80, 20),
                "STAMINA",
                textStyle
            );

            GUI.Box(
                new Rect(
                    100,
                    79,
                    125,
                    13
                ),
                ""
            );

            GUI.Box(
                new Rect(
                    102,
                    81,
                    121 * stamina,
                    9
                ),
                ""
            );

            GUI.Label(
                new Rect(
                    28,
                    96,
                    200,
                    20
                ),
                "WASD • SHIFT TO SPRINT",
                textStyle
            );
        }
    }
}
