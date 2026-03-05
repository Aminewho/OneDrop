package com.music.OneDrop.Config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        // Pour chaque route React connue, on redirige vers index.html
        // On évite les wildcards (**) qui font planter Spring Boot 3
        String[] reactRoutes = {
            "/", 
            "/separator", 
            "/library", 
            "/playlists", 
            "/spotify-callback", 
            "/spotify-search"
        };
        
        for (String route : reactRoutes) {
            registry.addViewController(route).setViewName("forward:/index.html");
        }
    }
}