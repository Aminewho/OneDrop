package com.music.OneDrop.Dto;






public class AppConfig {

    private String theme;
    private String logo;
    private String customer;

    public AppConfig() {
    }

    public AppConfig(String theme, String logo, String customer) {
        this.theme = theme;
        this.logo = logo;
        this.customer = customer;
    }

    public String getTheme() {
        return theme;
    }

    public void setTheme(String theme) {
        this.theme = theme;
    }

    public String getLogo() {
        return logo;
    }

    public void setLogo(String logo) {
        this.logo = logo;
    }

    public String getCustomer() {
        return customer;
    }

    public void setCustomer(String customer) {
        this.customer = customer;
    }
}