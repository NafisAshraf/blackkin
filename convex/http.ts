import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import {
  handleSuccess,
  handleFail,
  handleCancel,
  handleIpn,
} from "./paymentHttp";

const http = httpRouter();

// Better-auth routes
authComponent.registerRoutes(http, createAuth);

// SSLCommerz payment callbacks
http.route({ path: "/payment/success", method: "POST", handler: handleSuccess });
http.route({ path: "/payment/fail",    method: "POST", handler: handleFail    });
http.route({ path: "/payment/cancel",  method: "POST", handler: handleCancel  });
http.route({ path: "/payment/ipn",     method: "POST", handler: handleIpn     });

export default http;
