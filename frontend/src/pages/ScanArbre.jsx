import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertCircle,
  CalendarDays,
  Camera,
  CameraOff,
  ChevronDown,
  ExternalLink,
  Leaf,
  MapPin,
  QrCode,
  RefreshCw,
  Ruler,
  ScanLine,
  Search,
  TreePine,
  Upload,
  User
} from 'lucide-react';

// Correctif pour les icônes Leaflet (même configuration que la page Carte)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const treeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const SCANNER_ELEMENT_ID = 'qr-reader';
const FILE_SCANNER_ELEMENT_ID = 'qr-file-reader';

const SCAN_CONFIG = {
  fps: 10,
  qrbox: (viewfinderWidth, viewfinderHeight) => {
    const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.7);
    const size = Math.max(150, edge);
    return { width: size, height: size };
  },
  aspectRatio: 1
};

const getEtatBadge = (etat) => {
  if (etat === 'bon') return { label: 'Bon état', className: 'bg-green-100 text-green-700' };
  if (etat === 'moyen') return { label: 'État moyen', className: 'bg-yellow-100 text-yellow-700' };
  if (etat === 'faible') return { label: 'État faible', className: 'bg-red-100 text-red-700' };
  return { label: etat || 'Non renseigné', className: 'bg-gray-100 text-gray-700' };
};

const getEntretienBadge = (entretien) =>
  entretien === 'a_jour'
    ? { label: 'Entretien à jour', className: 'bg-blue-100 text-blue-700' }
    : { label: 'Entretien à planifier', className: 'bg-yellow-100 text-yellow-700' };

const formatDate = (value) => {
  if (!value) return 'Non renseignée';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
};

const getCameraErrorMessage = (error) => {
  const name = error?.name || '';
  const message = error?.message || String(error || '');
  const isPermissionDenied =
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    message.includes('NotAllowedError') ||
    message.includes('Permission');

  if (isPermissionDenied) {
    return "Accès à la caméra refusé. Autorisez la caméra dans les réglages du navigateur, puis réessayez.";
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || message.includes('NotFoundError')) {
    return "Aucune caméra détectée sur cet appareil. Importez une image ou saisissez le code manuellement.";
  }
  if (name === 'NotReadableError' || message.includes('NotReadableError') || message.includes('TrackStartError')) {
    return "La caméra est déjà utilisée par une autre application. Fermez-la puis réessayez.";
  }
  if (name === 'OverconstrainedError' || message.includes('OverconstrainedError')) {
    return "La caméra demandée n'est pas disponible sur cet appareil.";
  }
  return "Impossible de démarrer la caméra. Vérifiez les autorisations ou importez une image du QR code.";
};

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <Icon size={18} className="text-naatal-green mt-0.5 shrink-0" />
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900 break-words">{value || 'Non renseigné'}</p>
    </div>
  </div>
);

const TreeMap = ({ arbre }) => {
  if (!arbre.coord || arbre.coord.length !== 2) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-500">
        Coordonnées de localisation non disponibles pour cet arbre.
      </div>
    );
  }

  return (
    <MapContainer
      key={arbre.id}
      center={arbre.coord}
      zoom={17}
      scrollWheelZoom={false}
      style={{ height: '320px', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={arbre.coord} icon={treeIcon}>
        <Popup>
          <div className="p-1">
            <h3 className="font-semibold text-gray-900 mb-1">{arbre.espece}</h3>
            <p className="text-sm text-gray-600">{arbre.site}</p>
            <p className="text-xs text-gray-500 mt-1">{arbre.quartier}</p>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
};

const ScanArbre = () => {
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [loadingResult, setLoadingResult] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [demoTrees, setDemoTrees] = useState([]);
  const [showDemo, setShowDemo] = useState(false);

  const scannerRef = useRef(null);
  const scanningRef = useRef(false);
  const processingRef = useRef(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    axios
      .get('/api/trees/arbres')
      .then((response) => setDemoTrees(response.data.arbres || []))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        try {
          if (scanner.isScanning) scanner.stop().catch(() => {});
        } catch (err) {
          // La caméra est déjà arrêtée.
        }
        try {
          scanner.clear();
        } catch (err) {
          // Rien à nettoyer.
        }
      }
    };
  }, []);

  const lookupTree = async (rawCode) => {
    const code = String(rawCode || '').trim();
    if (!code) {
      setError("Aucun code d'arbre n'a été détecté. Réessayez le scan.");
      return;
    }

    setLoadingResult(true);
    setError(null);
    try {
      const response = await axios.get(`/api/trees/scan/${encodeURIComponent(code)}`);
      setResult(response.data.arbre);
    } catch (err) {
      setResult(null);
      setError(
        err.response?.data?.message ||
          "Impossible de récupérer la fiche de cet arbre. Vérifiez le code et réessayez."
      );
    } finally {
      setLoadingResult(false);
    }
  };

  const stopScanner = async () => {
    scanningRef.current = false;
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
    } catch (err) {
      // La caméra est peut-être déjà arrêtée.
    }
    try {
      scanner.clear();
    } catch (err) {
      // Rien à nettoyer.
    }
  };

  const handleDecoded = async (decodedText) => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      await stopScanner();
      await lookupTree(decodedText);
    } finally {
      processingRef.current = false;
    }
  };

  const startScanner = async () => {
    setError(null);
    setStarting(true);
    // Laisse le temps au conteneur vidéo d'être visible avant l'initialisation.
    await new Promise((resolve) => setTimeout(resolve, 60));

    try {
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false });
      scannerRef.current = scanner;
      scanningRef.current = true;
      await scanner.start(
        { facingMode: 'environment' },
        SCAN_CONFIG,
        (decodedText) => {
          if (!scanningRef.current) return;
          handleDecoded(decodedText);
        },
        () => {
          // Les échecs de lecture image par image sont normaux, on les ignore.
        }
      );
      setScanning(true);
    } catch (err) {
      scanningRef.current = false;
      scannerRef.current = null;
      setScanning(false);
      setError(getCameraErrorMessage(err));
    } finally {
      setStarting(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setManualCode('');
  };

  const handleManualSubmit = async (event) => {
    event.preventDefault();
    if (!manualCode.trim()) {
      setError("Veuillez saisir un code d'arbre (ex. ARB-001).");
      return;
    }
    await stopScanner();
    await lookupTree(manualCode);
  };

  const handleFileSelected = async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    await stopScanner();
    setFileLoading(true);
    try {
      const scanner = new Html5Qrcode(FILE_SCANNER_ELEMENT_ID, { verbose: false });
      try {
        const decodedText = await scanner.scanFile(file, false);
        await lookupTree(decodedText);
      } finally {
        try {
          scanner.clear();
        } catch (err) {
          // Rien à nettoyer.
        }
      }
    } catch (err) {
      setResult(null);
      setError(
        "Aucun QR code n'a pu être lu dans cette image. Utilisez une photo plus nette ou saisissez le code manuellement."
      );
    } finally {
      setFileLoading(false);
    }
  };

  const selectDemoTree = async (code) => {
    await stopScanner();
    await lookupTree(code);
  };

  const etatBadge = result ? getEtatBadge(result.etat) : null;
  const entretienBadge = result ? getEntretienBadge(result.entretien) : null;
  const coord = result?.localisation?.coordonnees || null;
  const insecureContext = typeof window !== 'undefined' && !window.isSecureContext;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Scanner un arbre</h1>
        <p className="text-gray-600 mt-1">
          Scannez le QR code fixé sur l'arbre pour afficher sa fiche et sa localisation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner */}
        <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-naatal-green-light text-naatal-green-dark">
              <QrCode size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Lecture du QR code</h2>
              <p className="text-xs text-gray-500">Caméra, image ou saisie manuelle</p>
            </div>
          </div>

          <div
            className="relative rounded-xl overflow-hidden bg-gray-900"
            style={{ minHeight: '280px' }}
          >
            <div id={SCANNER_ELEMENT_ID} className="w-full" />
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gray-900 text-gray-300">
                {starting || fileLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-white mb-3"></div>
                    <p className="text-sm">
                      {starting ? 'Préparation de la caméra...' : "Lecture de l'image..."}
                    </p>
                  </>
                ) : (
                  <>
                    <ScanLine size={44} strokeWidth={1.5} />
                    <p className="mt-3 text-sm font-medium text-white">Caméra désactivée</p>
                    <p className="mt-1 text-xs text-gray-400">
                      Activez la caméra pour scanner le QR code de l'arbre.
                    </p>
                  </>
                )}
              </div>
            )}
            {scanning && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-white/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                  <div className="w-full h-0.5 bg-naatal-green-light/90 animate-pulse mt-24"></div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {!scanning ? (
              <button
                type="button"
                onClick={startScanner}
                disabled={starting || fileLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-naatal-green text-white rounded-lg text-sm font-medium hover:bg-naatal-green-dark transition-colors disabled:opacity-60"
              >
                <Camera size={18} />
                {starting ? 'Démarrage...' : 'Activer la caméra'}
              </button>
            ) : (
              <button
                type="button"
                onClick={stopScanner}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <CameraOff size={18} />
                Arrêter la caméra
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={fileLoading}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              <Upload size={18} />
              Importer une image
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelected}
            />
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-2">
            <label htmlFor="manual-code" className="block text-sm font-medium text-gray-700">
              Saisir le code manuellement
            </label>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                id="manual-code"
                type="text"
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value)}
                placeholder="Ex. ARB-001"
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-naatal-green"
              />
              <button
                type="submit"
                disabled={loadingResult}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-60"
              >
                <Search size={16} />
                Rechercher
              </button>
            </form>
            <p className="text-xs text-gray-500">
              Formats acceptés : ARB-001, NAATAL-DAKAR:TREE:ARB-001 ou l'URL encodée dans le QR code.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
              <AlertCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {insecureContext && (
            <div className="flex items-start gap-2 rounded-lg bg-yellow-50 border border-yellow-200 p-3">
              <AlertCircle size={18} className="text-yellow-700 mt-0.5 shrink-0" />
              <p className="text-sm text-yellow-800">
                L'accès à la caméra nécessite HTTPS ou localhost. En HTTP, utilisez l'import d'image
                ou la saisie manuelle.
              </p>
            </div>
          )}

          {/* Élément masqué utilisé par html5-qrcode pour lire une image */}
          <div id={FILE_SCANNER_ELEMENT_ID} className="hidden" />
        </div>

        {/* Fiche de l'arbre */}
        <div className="bg-white rounded-xl p-5 card-shadow border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Fiche de l'arbre</h2>
            {result && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-naatal-green"
              >
                <RefreshCw size={14} />
                Réinitialiser
              </button>
            )}
          </div>

          {loadingResult ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-naatal-green"></div>
            </div>
          ) : result ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-naatal-green">
                    {result.id}
                  </p>
                  <h3 className="text-xl font-bold text-gray-900">{result.espece}</h3>
                  <p className="text-sm italic text-gray-500">{result.nomScientifique}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${etatBadge.className}`}>
                  {etatBadge.label}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow icon={MapPin} label="Quartier" value={result.localisation?.quartier || result.quartier} />
                <InfoRow icon={TreePine} label="Site" value={result.site} />
                <InfoRow icon={CalendarDays} label="Date de plantation" value={formatDate(result.datePlantation)} />
                <InfoRow icon={User} label="Responsable" value={result.responsable} />
                <InfoRow icon={Ruler} label="Hauteur" value={result.hauteur ? `${result.hauteur} m` : null} />
                <InfoRow
                  icon={Leaf}
                  label="Diamètre du tronc"
                  value={result.diametreTronc ? `${result.diametreTronc} cm` : null}
                />
              </div>

              <div className="rounded-lg bg-naatal-cream p-4 space-y-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">Localisation</p>
                <p className="text-sm font-medium text-gray-900">{result.adresse || result.site}</p>
                {coord && (
                  <p className="text-xs text-gray-600">
                    {coord.lat.toFixed(5)}, {coord.lng.toFixed(5)}
                  </p>
                )}
                {result.localisation?.lienCarte && (
                  <a
                    href={result.localisation.lienCarte}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-naatal-green hover:text-naatal-green-dark"
                  >
                    Ouvrir dans OpenStreetMap
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${entretienBadge.className}`}>
                  {entretienBadge.label}
                </span>
                {result.dernierEntretien && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    Dernier entretien : {formatDate(result.dernierEntretien)}
                  </span>
                )}
              </div>

              {result.notes && (
                <p className="text-sm text-gray-600 border-l-4 border-naatal-green pl-3">{result.notes}</p>
              )}

              <button
                type="button"
                onClick={() => {
                  handleReset();
                  startScanner();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-naatal-green text-white rounded-lg text-sm font-medium hover:bg-naatal-green-dark transition-colors"
              >
                <ScanLine size={18} />
                Scanner un autre arbre
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-16">
              <QrCode size={48} strokeWidth={1.5} className="text-gray-300" />
              <p className="mt-3 text-sm font-medium text-gray-600">Aucun arbre sélectionné</p>
              <p className="mt-1 text-xs text-gray-500 max-w-xs">
                Scannez le QR code d'un arbre ou saisissez son identifiant pour afficher sa fiche
                détaillée et sa position.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Carte de localisation */}
      {result && (
        <div className="bg-white rounded-xl card-shadow border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between gap-3 p-5 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-naatal-green" />
              <h2 className="text-lg font-semibold text-gray-900">Localisation de l'arbre</h2>
            </div>
            <span className="text-xs text-gray-500">{result.site}</span>
          </div>
          <TreeMap arbre={result} />
        </div>
      )}

      {/* QR codes de démonstration */}
      {demoTrees.length > 0 && (
        <div className="bg-white rounded-xl card-shadow border border-gray-100 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDemo((value) => !value)}
            className="w-full flex items-center justify-between gap-3 p-5 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <QrCode size={18} className="text-naatal-green" />
              <span className="text-lg font-semibold text-gray-900">QR codes de démonstration</span>
              <span className="px-2 py-0.5 rounded-full bg-naatal-green-light text-naatal-green-dark text-xs font-medium">
                {demoTrees.length}
              </span>
            </div>
            <ChevronDown
              size={20}
              className={`text-gray-500 transition-transform ${showDemo ? 'rotate-180' : ''}`}
            />
          </button>

          {showDemo && (
            <div className="p-5 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {demoTrees.map((arbre) => (
                <div
                  key={arbre.id}
                  className="flex items-center gap-4 border border-gray-100 rounded-xl p-3"
                >
                  <div className="bg-white p-1.5 border border-gray-200 rounded-lg shrink-0">
                    <QRCodeSVG value={arbre.code || arbre.id} size={84} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{arbre.id}</p>
                    <p className="text-sm text-gray-700 truncate">{arbre.espece}</p>
                    <p className="text-xs text-gray-500 truncate">{arbre.site}</p>
                    <button
                      type="button"
                      onClick={() => selectDemoTree(arbre.code || arbre.id)}
                      className="mt-2 text-xs font-medium text-naatal-green hover:text-naatal-green-dark"
                    >
                      Afficher la fiche
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScanArbre;
