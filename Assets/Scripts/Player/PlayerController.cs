using UnityEngine;

namespace WalkerNewDawn.Systems
{
    public class CameraFollow : MonoBehaviour
    {
        public Transform target;

        public float smoothSpeed = 8f;

        private void LateUpdate()
        {
            if (target == null)
                return;

            Vector3 targetPosition =
                new Vector3(
                    target.position.x,
                    target.position.y,
                    transform.position.z
                );

            transform.position =
                Vector3.Lerp(
                    transform.position,
                    targetPosition,
                    smoothSpeed * Time.deltaTime
                );
        }
    }
}
