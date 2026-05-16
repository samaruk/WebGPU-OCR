

export async function loadShader(path) {
    const response = await fetch(path);
    console.log(['loadShader(path)', path, response]);
    return await response.text();
}
