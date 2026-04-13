package com.music.OneDrop.Controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;


@Controller
public class RouteController {

    /**
     * Redirects non-static, non-api, and non-swagger paths to index.html for React Router.
     * We exclude:
     * - api/** (Your backend logic)
     * - v3/api-docs/** (Swagger JSON)
     * - swagger-ui/** (Swagger UI)
     * - search/** (Your Spotify/Youtube logic)
     */
    @RequestMapping(value = "{path:^(?!api|v3|swagger-ui|search).*$}[^\\.]*")
    public String redirect() {
        return "forward:/index.html";
    }
}