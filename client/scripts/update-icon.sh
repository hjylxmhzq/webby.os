link=https://at.alicdn.com/t/c/font_3901890_96g566cm7nq.js

curl ${link} -o ./src/icons/icons.js
echo -e "// eslint-disable-next-line\n$(cat ./src/icons/icons.js)" > ./src/icons/icons.js
cp ./src/icons/icons.js ../apps/src/icons/icons.js
