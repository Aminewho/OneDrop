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

        boolean isStaticFile = path.contains(".");
        boolean isApiCall    = path.startsWith("/api");
        boolean isSpotifyCall = path.startsWith("/search");  // ← ADD THIS
         boolean isYoutubeSearchCall = path.startsWith("/search/youtube");
           // ← ADD THIS
        if (!isStaticFile && !isApiCall && !isSpotifyCall &&   !isYoutubeSearchCall) {
            request.getRequestDispatcher("/index.html").forward(request, res);
            return;
        }

        chain.doFilter(req, res);
    }
}