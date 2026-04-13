package com.music.OneDrop.Config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;
import java.io.IOException;

@Component
public class SpaFilter implements Filter {

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest request = (HttpServletRequest) req;
        String path = request.getRequestURI();

        // 1. Identify what should NOT be forwarded to index.html
        boolean isStaticFile = path.contains(".");
        boolean isApiCall    = path.startsWith("/api");
        boolean isSpotifyCall = path.startsWith("/search");
        boolean isYoutubeSearchCall = path.startsWith("/search/youtube");
        
        // ADD THIS: Ignore Swagger UI and OpenAPI documentation paths
        boolean isSwagger = path.startsWith("/v3/api-docs") || 
                           path.startsWith("/swagger-ui");

        // 2. If it's not a static file, not an API, not search, AND NOT Swagger...
        // ...then it's a frontend route that needs index.html
        if (!isStaticFile && !isApiCall && !isSpotifyCall && !isYoutubeSearchCall && !isSwagger) {
            request.getRequestDispatcher("/index.html").forward(request, res);
            return;
        }

        // 3. Otherwise, let the request continue to the actual Controller or Static Resource
        chain.doFilter(req, res);
    }
}