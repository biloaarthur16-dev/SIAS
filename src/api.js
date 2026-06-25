import express from "express";

// Import des différents routeurs
import authRoutes from "./routes/auth.routes.js";
import assuresRoutes from "./routes/assures.routes.js";
import medecinsRoutes from "./routes/medecins.routes.js";
import consultationsRoutes from "./routes/consultations.routes.js";
import financesRoutes from "./routes/finances.routes.js";
import systemRoutes from "./routes/system.routes.js";

const router = express.Router();

// Montage des routes
router.use("/auth", authRoutes);
router.use("/assures", assuresRoutes);
router.use("/medecins", medecinsRoutes);
router.use("/consultations", consultationsRoutes);
router.use("/prescriptions", consultationsRoutes); // Les prescriptions sont gérées avec les consultations
router.use("/feuilles", financesRoutes);
router.use("/remboursements", financesRoutes);

// Montage des routes système directement à la racine de l'API (/api/stats, /api/specialites)
router.use("/", systemRoutes);

export default router;
