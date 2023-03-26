link=https://at.alicdn.com/t/c/font_3901890_nxwe1xwx9d.js

curl ${link} -o ./src/icons/icons.js
echo -e "// eslint-disable-next-line\n$(cat ./src/icons/icons.js)" > ./src/icons/icons.js
