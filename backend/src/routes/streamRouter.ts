import { Router } from "express";
import {createStreamToken} from '../controllers/streamControllers';
const router = Router()


router.post("/token", createStreamToken)


export default router;