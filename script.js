// Autenticación por clave
(function() {
  const claveCorrecta = "A501423";
  const estaAutenticado = sessionStorage.getItem('autenticado');
  
  if (estaAutenticado !== 'true') {
      const claveIngresada = prompt("Por favor, ingresa la clave para acceder:");
      
      if (claveIngresada === claveCorrecta) {
          sessionStorage.setItem('autenticado', 'true');
      } else {
          alert("Clave incorrecta. Acceso denegado.");
          // Redirigir al usuario a una página en blanco o de inicio
          window.location.href = "https://dmsnotsave.github.io/tottiauth/"; // Puedes cambiar la URL según prefieras
      }
  }
})();

  // Función para cerrar sesión
  document.addEventListener('DOMContentLoaded', function() {
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            sessionStorage.removeItem('autenticado');
            alert("Has cerrado sesión.");
            window.location.reload();
        });
    }

  // Configuración de Firebase
  const firebaseConfig = {
    apiKey: "AIzaSyAVLZ7Hyzc52A5f6YSbco1BAXvNss3VdCY",
    authDomain: "tottiauth-edd78.firebaseapp.com",
    projectId: "tottiauth-edd78",
    storageBucket: "tottiauth-edd78.firebasestorage.app",
    messagingSenderId: "846290820059",
    appId: "1:846290820059:web:f634ace70f59b53c5525fe",
  };


  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

  const addBtn = document.getElementById('addBtn');
  const totpItems = document.getElementById('totpItems');
  const platformNameInput = document.getElementById('platformName');
  const platformSecretInput = document.getElementById('platformSecret');

  // Añadir nuevo documento a Firestore
  addBtn.addEventListener('click', async () => {
    const name = platformNameInput.value.trim();
    let secret = platformSecretInput.value.trim().replace(/\s+/g, ''); // Eliminar espacios
    if (name && secret) {
        // Opcional: Convertir a mayúsculas para estandarizar
        secret = secret.toUpperCase();
        try {
            await db.collection('totpKeys').add({ name, secret });
            platformNameInput.value = '';
            platformSecretInput.value = '';
            alert("Plataforma agregada correctamente.");
        } catch (error) {
            console.error("Error al agregar la plataforma: ", error);
            alert("Error al agregar la plataforma. Revisa la consola para más detalles.");
        }
    } else {
        alert("Por favor, ingresa tanto el nombre de la plataforma como la clave secreta.");
    }
  });

  // Función para convertir base32 a array de bytes
  function base32ToBytes(base32) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    let bytes = [];
    base32 = base32.replace(/\s+/g, '').toUpperCase(); // Eliminar espacios y convertir a mayúsculas
    for (let i = 0; i < base32.length; i++) {
        const val = alphabet.indexOf(base32.charAt(i));
        if (val === -1) {
            // Caracter inválido, ignorar
            continue;
        }
        bits += val.toString(2).padStart(5, '0');
    }
    for (let i = 0; i + 7 < bits.length; i += 8) {
        bytes.push(parseInt(bits.substr(i, 8), 2));
    }
    return new Uint8Array(bytes);
  }

  // Función para generar TOTP
  function generateTOTP(secret, timeStep = 30, digits = 6) {
    const secretBytes = base32ToBytes(secret);
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / timeStep);
    const counterBuffer = new ArrayBuffer(8);
    const counterView = new DataView(counterBuffer);
    counterView.setUint32(4, counter);

    // HMAC-SHA1
    const shaObj = new jsSHA("SHA-1", "ARRAYBUFFER");
    shaObj.setHMACKey(secretBytes, "UINT8ARRAY");
    shaObj.update(new Uint8Array(counterBuffer));
    const hmacResult = shaObj.getHMAC("UINT8ARRAY");

    const offset = hmacResult[hmacResult.length - 1] & 0x0f;
    const binary = ((hmacResult[offset] & 0x7f) << 24) |
                  ((hmacResult[offset + 1] & 0xff) << 16) |
                  ((hmacResult[offset + 2] & 0xff) << 8) |
                  (hmacResult[offset + 3] & 0xff);

    let otp = binary % (10 ** digits);
    return otp.toString().padStart(digits, '0');
  }

  // Función para renderizar los items
  function renderItems(docs) {
    totpItems.innerHTML = '';
    docs.forEach(doc => {
        const data = doc.data();
        const li = document.createElement('li');
        li.classList.add('totp-item');

        const infoDiv = document.createElement('div');
        infoDiv.classList.add('info');

        const platformSpan = document.createElement('span');
        platformSpan.classList.add('platform');
        platformSpan.textContent = data.name;

        const codeSpan = document.createElement('span');
        codeSpan.classList.add('code');

        const timeLeftSpan = document.createElement('span');
        timeLeftSpan.classList.add('time-left');

        infoDiv.appendChild(platformSpan);
        infoDiv.appendChild(codeSpan);
        infoDiv.appendChild(timeLeftSpan);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Eliminar';
        deleteBtn.addEventListener('click', () => {
            db.collection('totpKeys').doc(doc.id).delete().catch(error => {
                console.error("Error al eliminar la plataforma: ", error);
                alert("Error al eliminar la plataforma. Revisa la consola para más detalles.");
            });
        });

        li.appendChild(infoDiv);
        li.appendChild(deleteBtn);
        totpItems.appendChild(li);

        // Actualización periódica del código y tiempo restante
        function updateCodeAndTime() {
            const timeStep = 30;
            const now = Math.floor(Date.now() / 1000);
            const counter = Math.floor(now / timeStep);
            const totp = generateTOTP(data.secret, timeStep);
            codeSpan.textContent = totp;

            const timeElapsed = now % timeStep;
            const timeRemaining = timeStep - timeElapsed;
            timeLeftSpan.textContent = `Caduca en: ${timeRemaining}s`;
        }

        updateCodeAndTime();
        setInterval(updateCodeAndTime, 1000);
    });
  }

  // Escucha cambios en Firestore
  db.collection('totpKeys').onSnapshot(snapshot => {
    renderItems(snapshot.docs);
  }, error => {
    console.error("Error al escuchar los cambios de Firestore: ", error);
    alert("Error al cargar las plataformas. Revisa la consola para más detalles.");
  });
});
